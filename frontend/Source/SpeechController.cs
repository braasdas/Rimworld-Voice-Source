using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Verse;
using RimWorld;

namespace ColonistVoices
{
    public class SpeechController : GameComponent
    {
        private Dictionary<Pawn, int> lastSpeechTick = new Dictionary<Pawn, int>();
        private Dictionary<Pawn, Coroutine> activeRequests = new Dictionary<Pawn, Coroutine>();
        private Dictionary<Pawn, List<string>> speechHistory = new Dictionary<Pawn, List<string>>(); // Last 5 speeches per colonist
        private const int MAX_SPEECH_HISTORY = 5;
        private int tickCounter = 0;
        private const int CHECK_INTERVAL = 250; // Check every 250 ticks (~4 seconds)
        private bool hasCheckedWelcomeMessage = false;
        
        public SpeechController(Game game)
        {
        }
        
        public override void GameComponentTick()
        {
            base.GameComponentTick();
            
            // Show welcome message on first tick in game (after save fully loaded)
            if (!hasCheckedWelcomeMessage)
            {
                hasCheckedWelcomeMessage = true;
                
                if (!ColonistVoicesMod.settings.hasShownWelcomeMessage)
                {
                    ColonistVoicesMod.settings.hasShownWelcomeMessage = true;
                    ColonistVoicesMod.settings.Write();
                    ShowWelcomeDialog();
                }
            }
            
            tickCounter++;
            if (tickCounter < CHECK_INTERVAL)
                return;
            
            tickCounter = 0;
            
            var settings = ColonistVoicesMod.settings;
            if (!settings.enableRandomSpeech)
                return;
            
            // Check each colonist for potential speech
            foreach (Pawn colonist in PawnsFinder.AllMaps_FreeColonists)
            {
                if (!colonist.Spawned || colonist.Dead || colonist.Downed)
                    continue;
                
                // Check if colonist is on cooldown
                if (lastSpeechTick.ContainsKey(colonist))
                {
                    int ticksSinceLastSpeech = Find.TickManager.TicksGame - lastSpeechTick[colonist];
                    int cooldownTicks = settings.minimumHoursBetweenSpeech * 2500; // 2500 ticks per hour
                    
                    if (ticksSinceLastSpeech < cooldownTicks)
                        continue;
                }
                
                // Check if we have an active request for this colonist
                if (activeRequests.ContainsKey(colonist))
                    continue;
                
                // Random chance check
                float chancePerCheck = (settings.baseChancePerHour / 100f) * (CHECK_INTERVAL / 2500f);
                if (Rand.Value > chancePerCheck)
                    continue;
                
                // Trigger speech!
                TriggerSpeech(colonist);
            }
        }
        
        public void TriggerSpeech(Pawn colonist)
        {
            try
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Message("[ColonistVoices] TriggerSpeech called for " + colonist.Name.ToStringShort);
                
                // CRITICAL: Check if request already active
                if (activeRequests.ContainsKey(colonist))
                {
                    if (ColonistVoicesMod.settings.debugMode)
                        Log.Warning(string.Format("[ColonistVoices] ⚠ Duplicate request blocked for {0}", colonist.Name.ToStringShort));
                    return;
                }
                
                // Check if colonist spoke too recently
                if (lastSpeechTick.ContainsKey(colonist))
                {
                    int ticksSinceLastSpeech = Find.TickManager.TicksGame - lastSpeechTick[colonist];
                    int cooldownTicks = ColonistVoicesMod.settings.minimumHoursBetweenSpeech * 2500;
                    
                    if (ticksSinceLastSpeech < cooldownTicks)
                    {
                        if (ColonistVoicesMod.settings.debugMode)
                            Log.Message(string.Format("[ColonistVoices] Cooldown active for {0}", colonist.Name.ToStringShort));
                        return;
                    }
                }
                
                // Check concurrent request limit (hardcoded to 1 since RimWorld can only play one audio at a time)
                if (activeRequests.Count >= 1)
                {
                    if (ColonistVoicesMod.settings.debugMode)
                        Log.Warning(string.Format("[ColonistVoices] ⚠ Audio already playing, skipping {0}", colonist.Name.ToStringShort));
                    return;
                }
                
                // ADD TO ACTIVE LIST IMMEDIATELY before starting coroutine
                activeRequests[colonist] = null; // Reserve the slot
                
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Message(string.Format("[ColonistVoices] Starting speech generation for {0}", colonist.Name.ToStringShort));
                
                Coroutine coroutine = CoroutineManager.Instance.StartCoroutine(ProcessSpeechRequest(colonist));
                activeRequests[colonist] = coroutine; // Update with actual coroutine
            }
            catch (Exception e)
            {
                Log.Error("[ColonistVoices] Exception in TriggerSpeech: " + e.ToString());
                // Clean up if exception occurs
                if (activeRequests.ContainsKey(colonist))
                    activeRequests.Remove(colonist);
            }
        }
        
        private IEnumerator ProcessSpeechRequest(Pawn colonist)
        {
            if (ColonistVoicesMod.settings.debugMode)
                Log.Message(string.Format("[ColonistVoices] Processing speech for {0}", colonist.Name.ToStringShort));
            
            // Double-check we're still in activeRequests (edge case protection)
            if (!activeRequests.ContainsKey(colonist))
            {
                Log.Error(string.Format("[ColonistVoices] ⚠ Fatal: {0} not in activeRequests!", colonist.Name.ToStringShort));
                yield break;
            }
            
            string speechText = null;
            AudioClip audioClip = null;
            bool hasError = false;
            string errorMessage = "";
            
            // Step 1: Build context with speech history
            string context = ColonistContextBuilder.BuildContext(colonist);
            
            // Add recent speech history to context
            if (speechHistory.ContainsKey(colonist) && speechHistory[colonist].Count > 0)
            {
                context += "\n\nRECENT SPEECH HISTORY (avoid repetition):\n";
                for (int i = 0; i < speechHistory[colonist].Count; i++)
                {
                    context += string.Format("{0}. \"{1}\"\n", i + 1, speechHistory[colonist][i]);
                }
            }
            
            if (ColonistVoicesMod.settings.debugMode)
            {
                Log.Message(string.Format("[ColonistVoices] Context: {0} chars", context.Length));
                Log.Message(string.Format("[ColonistVoices] Preview: {0}...", context.Substring(0, Mathf.Min(200, context.Length))));
            }
            
            // Step 2: Get voice ID
            string voiceId = GetVoiceForColonist(colonist);
            if (ColonistVoicesMod.settings.debugMode)
                Log.Message(string.Format("[ColonistVoices] Voice: {0} ({1})", VoiceSelector.GetVoiceName(voiceId), voiceId));
            
            // Step 3: Call backend for speech generation + audio
                
            bool backendComplete = false;
            
            yield return BackendAPIHandler.GenerateSpeech(
                context,
                ColonistVoicesMod.settings.systemPrompt,
                ColonistVoicesMod.settings.openAIModel,
                voiceId,
                ColonistVoicesMod.settings.voiceStability,
                ColonistVoicesMod.settings.voiceSimilarityBoost,
                (clip, text) =>
                {
                    audioClip = clip;
                    speechText = text;
                    backendComplete = true;
                    Log.Message(string.Format("[ColonistVoices] ✓ {0}: '{1}'", colonist.Name.ToStringShort, text));
                },
                (error) =>
                {
                    hasError = true;
                    errorMessage = error;
                    backendComplete = true;
                    Log.Error(string.Format("[ColonistVoices] ✗ Error: {0}", error));
                }
            );
            
            // Wait for backend to complete
            int waitCount = 0;
            while (!backendComplete)
            {
                waitCount++;
                if (ColonistVoicesMod.settings.debugMode && waitCount % 100 == 0)
                {
                    Log.Message(string.Format("[ColonistVoices] Waiting... ({0} frames)", waitCount));
                }
                yield return null;
            }
            
            if (hasError || audioClip == null || string.IsNullOrEmpty(speechText))
            {
                if (hasError)
                {
                    Log.Error("[ColonistVoices] ✗ " + errorMessage);
                }
                else
                {
                    Log.Error("[ColonistVoices] ✗ Failed to generate speech (no audio/text)");
                }
                
                // CRITICAL: Remove from active requests on error
                if (activeRequests.ContainsKey(colonist))
                    activeRequests.Remove(colonist);
                yield break;
            }
            
            // Step 4: Play audio and wait for completion
            try
            {
                // Update last speech time immediately when audio starts
                lastSpeechTick[colonist] = Find.TickManager.TicksGame;
                
                // Add to speech history
                if (!speechHistory.ContainsKey(colonist))
                    speechHistory[colonist] = new List<string>();
                
                speechHistory[colonist].Add(speechText);
                
                // Keep only last 5 speeches
                if (speechHistory[colonist].Count > MAX_SPEECH_HISTORY)
                    speechHistory[colonist].RemoveAt(0);
                
                // Play audio with callback to clean up when done
                AudioManager.Instance.PlayAudio(audioClip, colonist, speechText, () =>
                {
                    // Clean up from activeRequests ONLY after audio finishes playing
                    if (activeRequests.ContainsKey(colonist))
                    {
                        activeRequests.Remove(colonist);
                        if (ColonistVoicesMod.settings.debugMode)
                            Log.Message(string.Format("[ColonistVoices] Removed {0} from activeRequests (audio complete)", colonist.Name.ToStringShort));
                    }
                });
            }
            catch (Exception e)
            {
                Log.Error(string.Format("[ColonistVoices] ✗ Audio playback error: {0}", e.Message));
                
                // Clean up on error
                if (activeRequests.ContainsKey(colonist))
                    activeRequests.Remove(colonist);
            }
        }
        
        private string GetVoiceForColonist(Pawn colonist)
        {
            // Use the sophisticated voice selector
            return VoiceSelector.SelectVoiceForColonist(colonist);
        }
        
        public override void ExposeData()
        {
            base.ExposeData();
            Scribe_Collections.Look(ref lastSpeechTick, "lastSpeechTick", LookMode.Reference, LookMode.Value);
            
            // Don't save speechHistory - it's just a memory cache to avoid repetition
            // It will be rebuilt naturally as colonists speak after loading
            
            if (Scribe.mode == LoadSaveMode.LoadingVars)
            {
                if (lastSpeechTick == null)
                    lastSpeechTick = new Dictionary<Pawn, int>();
                
                // Always initialize speechHistory on load
                if (speechHistory == null)
                    speechHistory = new Dictionary<Pawn, List<string>>();
            }
        }
        
        private void ShowWelcomeDialog()
        {
            // Safety check - make sure WindowStack is available
            if (Find.WindowStack == null)
            {
                Log.Warning("[ColonistVoices] WindowStack not ready, skipping welcome message");
                return;
            }
            
            DiaNode welcomeNode = new DiaNode(
                "<b>Thanks for installing Colonist Voices!</b>\n\n" +
                "<b>🎤 What it does:</b>\n" +
                "Your colonists will speak with unique AI-generated voices based on their personality, mood, and current situation.\n\n" +
                "<b>⚙️ Quick Setup:</b>\n" +
                "• FREE: 10 speeches/month (no registration)\n" +
                "• Configure in: Mod Options > Colonist Voices\n" +
                "• Speeches happen automatically during gameplay\n\n" +
                "<b>💎 Want Unlimited Speeches?</b>\n" +
                "Join our Discord for supporter codes:\n" +
                "discord.gg/r9Ez58FSp4\n\n" +
                "<b>✨ Tips:</b>\n" +
                "• First speech may take a few seconds\n" +
                "• Each colonist gets a unique voice\n" +
                "• Adjust frequency & settings anytime\n\n" +
                "Enjoy and thanks for your support!"
            );
            
            // "Got it!" button
            DiaOption closeOption = new DiaOption("Got it!");
            closeOption.resolveTree = true;
            welcomeNode.options.Add(closeOption);
            
            // "Copy Discord Link" button
            DiaOption discordOption = new DiaOption("Copy Discord Link");
            discordOption.action = delegate
            {
                GUIUtility.systemCopyBuffer = "https://discord.gg/r9Ez58FSp4";
                Messages.Message("Discord link copied to clipboard!", MessageTypeDefOf.PositiveEvent, false);
            };
            discordOption.resolveTree = false; // Don't close the dialog
            welcomeNode.options.Add(discordOption);
            
            Dialog_NodeTree dialog = new Dialog_NodeTree(welcomeNode);
            dialog.soundClose = SoundDefOf.Click;
            Find.WindowStack.Add(dialog);
        }
    }
}
