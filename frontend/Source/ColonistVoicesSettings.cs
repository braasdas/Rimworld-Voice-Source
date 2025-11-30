using UnityEngine;
using Verse;
using RimWorld;
using System.Collections.Generic;
using System.Linq;

namespace ColonistVoices
{
    public class ColonistVoicesSettings : ModSettings
    {
        // Backend Settings
        public string backendUrl = "https://api.leadleap.net:3443"; // Default official server
        
        // User Authentication
        public string userApiKey = ""; // Format: CV-XXXX-XXXX-XXXX-XXXX
        public string hardwareId = ""; // Auto-generated on first launch
        
        // Usage Stats (cached from last API call)
        public string userTier = "unknown";
        public int speechesRemaining = -1;
        public string lastStatusCheck = "";
        
        // Model & Prompt Settings (sent to backend)
        public string openAIModel = "gpt-4o-mini";
        public string systemPrompt = "You are a colonist in RimWorld speaking naturally with FULL emotional expression. Generate a short, expressive spoken line (1-3 sentences) using ElevenLabs audio tags to convey emotion and character.\n\nRULES:\n1. Use audio tags strategically: [laughs], [sighs], [whispers], [excited], [frustrated], [sarcastic], [curious], [crying], etc.\n2. Add emphasis with CAPITALIZATION for stressed words\n3. Use ellipses (...) for dramatic pauses or trailing thoughts\n4. Match emotion to context - happy moments get [laughs], stress gets [sighs], danger gets [whispers] or urgency\n5. Make it FEEL alive and real - colonists should sound like actual people reacting to their world\n6. Keep it under 40 words but pack in personality\n7. NO quotation marks, NO narration, just the raw emotional speech with tags\n8. IMPORTANT: Review the colonist's recent speech history and generate something DIFFERENT - avoid repeating similar phrases, emotions, or sentence structures\n\nExamples:\n- Happy: \"[excited] This is AMAZING! We actually pulled it off!\"\n- Stressed: \"[exhausted sigh] Another raid... I can't keep doing this.\"\n- Contemplative: \"[thoughtful] I wonder if... [pause] maybe we should have stayed on Earth.\"\n- Scared: \"[whispers urgently] Did you hear that? Something's out there...\"\n\nGenerate speech that matches the colonist's current emotional state and situation.";
        
        // Voice Settings
        public string defaultVoiceId = "CfWnoh8IFarSWXABltY8"; // Linda - Verified working voice
        public Dictionary<string, string> colonistVoices = new Dictionary<string, string>();
        public float voiceStability = 0.0f;  // 0.0 = Creative (most expressive), 0.5 = Natural, 1.0 = Robust
        public float voiceSimilarityBoost = 0.75f;
        
        // Trigger Settings
        public float baseChancePerHour = 2.5f; // 2.5% chance per hour (max 5%)
        public int minimumHoursBetweenSpeech = 6; // Minimum 6 hours
        public bool enableSpeechDuringEvents = true;
        public bool enableRandomSpeech = true;
        
        // Context Settings
        public bool includeThoughts = true;
        public bool includeHediffs = true;
        public bool includeRecentMemories = true;
        public bool includeRelationships = true;
        public bool includeCurrentActivity = true;
        public int maxRecentMemories = 5;
        
        // Performance Settings
        public bool enableCaching = true;
        public bool debugMode = false;
        
        // First-time setup
        public bool hasShownWelcomeMessage = false;
        public bool hasShownQuotaExhaustedDialog = false;
        
        public override void ExposeData()
        {
            Scribe_Values.Look(ref backendUrl, "backendUrl", "https://api.leadleap.net:3443");
            Scribe_Values.Look(ref userApiKey, "userApiKey", "");
            Scribe_Values.Look(ref hardwareId, "hardwareId", "");
            Scribe_Values.Look(ref userTier, "userTier", "unknown");
            Scribe_Values.Look(ref speechesRemaining, "speechesRemaining", -1);
            Scribe_Values.Look(ref lastStatusCheck, "lastStatusCheck", "");
            Scribe_Values.Look(ref openAIModel, "openAIModel", "gpt-4o-mini");
            Scribe_Values.Look(ref systemPrompt, "systemPrompt", "You are a colonist in RimWorld speaking naturally with FULL emotional expression. Generate a short, expressive spoken line (1-3 sentences) using ElevenLabs audio tags to convey emotion and character.\n\nRULES:\n1. Use audio tags strategically: [laughs], [sighs], [whispers], [excited], [frustrated], [sarcastic], [curious], [crying], etc.\n2. Add emphasis with CAPITALIZATION for stressed words\n3. Use ellipses (...) for dramatic pauses or trailing thoughts\n4. Match emotion to context - happy moments get [laughs], stress gets [sighs], danger gets [whispers] or urgency\n5. Make it FEEL alive and real - colonists should sound like actual people reacting to their world\n6. Keep it under 40 words but pack in personality\n7. NO quotation marks, NO narration, just the raw emotional speech with tags\n8. IMPORTANT: Review the colonist's recent speech history and generate something DIFFERENT - avoid repeating similar phrases, emotions, or sentence structures\n\nExamples:\n- Happy: \"[excited] This is AMAZING! We actually pulled it off!\"\n- Stressed: \"[exhausted sigh] Another raid... I can't keep doing this.\"\n- Contemplative: \"[thoughtful] I wonder if... [pause] maybe we should have stayed on Earth.\"\n- Scared: \"[whispers urgently] Did you hear that? Something's out there...\"\n\nGenerate speech that matches the colonist's current emotional state and situation.");
            Scribe_Values.Look(ref defaultVoiceId, "defaultVoiceId", "CfWnoh8IFarSWXABltY8");
            Scribe_Values.Look(ref voiceStability, "voiceStability", 0.0f);
            Scribe_Values.Look(ref voiceSimilarityBoost, "voiceSimilarityBoost", 0.75f);
            Scribe_Values.Look(ref baseChancePerHour, "baseChancePerHour", 2.5f);
            Scribe_Values.Look(ref minimumHoursBetweenSpeech, "minimumHoursBetweenSpeech", 6);
            Scribe_Values.Look(ref enableSpeechDuringEvents, "enableSpeechDuringEvents", true);
            Scribe_Values.Look(ref enableRandomSpeech, "enableRandomSpeech", true);
            Scribe_Values.Look(ref includeThoughts, "includeThoughts", true);
            Scribe_Values.Look(ref includeHediffs, "includeHediffs", true);
            Scribe_Values.Look(ref includeRecentMemories, "includeRecentMemories", true);
            Scribe_Values.Look(ref includeRelationships, "includeRelationships", true);
            Scribe_Values.Look(ref includeCurrentActivity, "includeCurrentActivity", true);
            Scribe_Values.Look(ref maxRecentMemories, "maxRecentMemories", 5);
            Scribe_Values.Look(ref enableCaching, "enableCaching", true);
            Scribe_Values.Look(ref debugMode, "debugMode", false);
            Scribe_Values.Look(ref hasShownWelcomeMessage, "hasShownWelcomeMessage", false);
            Scribe_Values.Look(ref hasShownQuotaExhaustedDialog, "hasShownQuotaExhaustedDialog", false);
            Scribe_Collections.Look(ref colonistVoices, "colonistVoices", LookMode.Value, LookMode.Value);
            
            if (colonistVoices == null)
                colonistVoices = new Dictionary<string, string>();
        }
    }
    
    public class ColonistVoicesMod : Mod
    {
        public static ColonistVoicesSettings settings;
        
        private Vector2 scrollPosition;
        private string tempApiKey = ""; // Temporary storage while editing
        private bool isEditingApiKey = false;
        private string supporterCode = "";
        
        // Restricted to gpt-4o-mini only for cost management
        private string[] availableModels = new string[]
        {
            "gpt-4o-mini"
        };
        
        public ColonistVoicesMod(ModContentPack content) : base(content)
        {
            settings = GetSettings<ColonistVoicesSettings>();
            
            // Force model to gpt-4o-mini for cost management
            if (settings.openAIModel != "gpt-4o-mini")
            {
                Log.Message("[ColonistVoices] Forcing model to gpt-4o-mini for cost management");
                settings.openAIModel = "gpt-4o-mini";
                settings.Write();
            }
            
            // Generate hardware ID on first launch
            if (string.IsNullOrEmpty(settings.hardwareId))
            {
                settings.hardwareId = GenerateHardwareId();
                settings.Write();
                Log.Message("[ColonistVoices] Generated hardware ID: " + settings.hardwareId);
            }
            
            // Auto-register if no API key exists
            if (string.IsNullOrEmpty(settings.userApiKey))
            {
                Log.Message("[ColonistVoices] No API key found, will auto-register on first use");
            }
        }
        
        private static string GenerateHardwareId()
        {
            // Generate a unique ID based on system info
            string uniqueString = SystemInfo.deviceUniqueIdentifier + 
                                SystemInfo.deviceName + 
                                SystemInfo.deviceModel;
            
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                byte[] hash = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(uniqueString));
                return System.Convert.ToBase64String(hash).Substring(0, 32).Replace("/", "").Replace("+", "");
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
            
            Find.WindowStack.Add(new Dialog_MessageBox(
                "<b>Thanks for installing Colonist Voices!</b>\n\n" +
                "<b>🎤 What it does:</b>\n" +
                "Your colonists will speak with unique AI-generated voices based on their personality, mood, and current situation.\n\n" +
                "<b>⚙️ Quick Setup:</b>\n" +
                "• FREE: 10 speeches/month (no registration)\n" +
                "• Configure in: Mod Options > Colonist Voices\n" +
                "• Speeches happen automatically during gameplay\n\n" +
                "<b>💎 Want Unlimited Speeches?</b>\n" +
                "Join our Discord for supporter codes:\n" +
                "<color=#7289DA>discord.gg/yWC3Arr7pA</color>\n\n" +
                "<b>✨ Tips:</b>\n" +
                "• First speech may take a few seconds\n" +
                "• Each colonist gets a unique voice\n" +
                "• Adjust frequency & settings anytime\n\n" +
                "Enjoy and thanks for your support!",
                "Colonist Voices - Welcome",
                delegate
                {
                    // Do nothing, just close
                },
                null,
                null,
                "Got it!"
            ));
        }
        
        public static void ShowQuotaExhaustedDialog()
        {
            // Safety check - make sure WindowStack is available
            if (Find.WindowStack == null)
            {
                Log.Warning("[ColonistVoices] WindowStack not ready, skipping quota exhausted message");
                return;
            }
            
            // Only show once per game session
            if (settings.hasShownQuotaExhaustedDialog)
            {
                return;
            }
            
            settings.hasShownQuotaExhaustedDialog = true;
            settings.Write();
            
            Find.WindowStack.Add(new Dialog_MessageBox(
                "<b>🎤 You've Used All Your Free Speeches!</b>\n\n" +
                "You've reached your monthly limit of 10 free speeches.\n\n" +
                "<b>💎 Want Unlimited Speeches?</b>\n\n" +
                "<b>Option 1: Get a Supporter Code</b>\n" +
                "Join our Discord community to receive a supporter code for unlimited speeches:\n" +
                "<color=#7289DA>discord.gg/yWC3Arr7pA</color>\n\n" +
                "<b>Option 2: Contribute Your ElevenLabs Key</b>\n" +
                "Have an ElevenLabs API key? Share it with us and get:\n" +
                "• Special Contributor status\n" +
                "• Extra credits for your generosity\n" +
                "• Priority queue access\n\n" +
                "Visit our Discord to learn more about both options!\n\n" +
                "<b>📝 Note:</b> Your free quota resets on the 1st of each month.",
                "Colonist Voices - Quota Exhausted",
                delegate
                {
                    Application.OpenURL("https://discord.gg/yWC3Arr7pA");
                },
                null,
                null,
                "Join Discord"
            ));
        }
        
        public override string SettingsCategory()
        {
            return "Colonist Voices (Backend)";
        }
        
        public override void DoSettingsWindowContents(Rect inRect)
        {
            Listing_Standard listingStandard = new Listing_Standard();
            Rect viewRect = new Rect(0f, 0f, inRect.width - 20f, 2400f);
            
            Widgets.BeginScrollView(inRect, ref scrollPosition, viewRect);
            listingStandard.Begin(viewRect);
            
            // Backend Configuration Section
            listingStandard.Label((TaggedString)"=== Backend Configuration ===", -1f);
            listingStandard.Gap(6f);
            
            listingStandard.Label("Backend Server URL:");
            // Display "default" but keep actual URL hidden
            string displayUrl = settings.backendUrl == "https://api.leadleap.net:3443" ? "default" : settings.backendUrl;
            string newUrl = listingStandard.TextEntry(displayUrl);
            // If user types "default", keep the actual URL unchanged
            if (newUrl != "default" && newUrl != displayUrl)
            {
                settings.backendUrl = newUrl;
            }
            Text.Font = GameFont.Tiny;
            listingStandard.Label("Leave as 'default' to use official managed server");
            Text.Font = GameFont.Small;
            listingStandard.Gap(6f);
            
            if (listingStandard.ButtonText("Test Connection"))
            {
                TestBackendConnection();
            }
            listingStandard.Gap(12f);
            
            // API Key Section
            listingStandard.Label((TaggedString)"=== API Key & Account ===", -1f);
            listingStandard.Gap(6f);
            
            if (string.IsNullOrEmpty(settings.userApiKey))
            {
                listingStandard.Label("Status: No API Key (Headless Mode)");
                Text.Font = GameFont.Tiny;
                listingStandard.Label("You can use 10 speeches/month per IP without registering.");
                listingStandard.Label("Register for a FREE account to get 10 speeches/month tracked to your key.");
                Text.Font = GameFont.Small;
                listingStandard.Gap(6f);
                
                if (listingStandard.ButtonText("Register FREE Account"))
                {
                    RegisterUser();
                }
            }
            else
            {
                // Display masked API key
                string maskedKey = MaskApiKey(settings.userApiKey);
                listingStandard.Label("API Key: " + maskedKey);
                
                // Show tier and usage
                string tierColor = settings.userTier == "supporter" ? "#4CAF50" : 
                                 settings.userTier == "patron" ? "#FF9800" : "#2196F3";
                listingStandard.Label(string.Format("Tier: <color={0}>{1}</color>", tierColor, settings.userTier.ToUpper()));
                
                if (settings.userTier == "free")
                {
                    listingStandard.Label(string.Format("Speeches Remaining: {0}/10", 
                        settings.speechesRemaining >= 0 ? settings.speechesRemaining.ToString() : "?"));
                }
                else if (settings.userTier == "supporter")
                {
                    listingStandard.Label("Speeches: UNLIMITED (Thank you for supporting!)");
                }
                else if (settings.userTier == "patron")
                {
                    listingStandard.Label("Speeches: UNLIMITED + Priority Queue (Thank you!)");
                }
                
                if (!string.IsNullOrEmpty(settings.lastStatusCheck))
                {
                    Text.Font = GameFont.Tiny;
                    listingStandard.Label("Last updated: " + settings.lastStatusCheck);
                    Text.Font = GameFont.Small;
                }
                
                listingStandard.Gap(6f);
                
                if (listingStandard.ButtonText("Refresh Account Status"))
                {
                    RefreshAccountStatus();
                }
                
                if (listingStandard.ButtonText("Change API Key"))
                {
                    isEditingApiKey = true;
                    tempApiKey = settings.userApiKey;
                }
            }
            
            // Supporter code redemption
            listingStandard.Gap(6f);
            listingStandard.Label("Have a supporter code?");
            supporterCode = listingStandard.TextEntry(supporterCode);
            
            if (listingStandard.ButtonText("Redeem Code"))
            {
                RedeemSupporterCode();
            }
            
            Text.Font = GameFont.Tiny;
            listingStandard.Label("Get supporter codes for unlimited speeches:");
            
            // Make the Discord link clickable
            Rect discordLinkRect = listingStandard.GetRect(20f);
            Widgets.Label(discordLinkRect, "<color=#7289DA>Join our Discord: discord.gg/yWC3Arr7pA</color>");
            if (Widgets.ButtonInvisible(discordLinkRect))
            {
                Application.OpenURL("https://discord.gg/yWC3Arr7pA");
            }
            if (Mouse.IsOver(discordLinkRect))
            {
                Widgets.DrawHighlight(discordLinkRect);
                TooltipHandler.TipRegion(discordLinkRect, "Click to open Discord invite");
            }
            
            Text.Font = GameFont.Small;
            listingStandard.Gap(12f);
            
            // Model Settings Section
            listingStandard.Label((TaggedString)"=== Model Settings ===", -1f);
            listingStandard.Gap(6f);
            
            listingStandard.Label(string.Format("OpenAI Model: {0} (Fixed)", settings.openAIModel));
            Text.Font = GameFont.Tiny;
            listingStandard.Label("Model is fixed to gpt-4o-mini for cost management");
            Text.Font = GameFont.Small;
            listingStandard.Gap(6f);
            
            listingStandard.Label("System Prompt (OpenAI instructions):");
            listingStandard.Gap(3f);
            float textHeight = Text.CalcHeight(settings.systemPrompt, viewRect.width - 20f);
            Rect textAreaRect = listingStandard.GetRect(Mathf.Max(textHeight + 10f, 100f));
            settings.systemPrompt = Widgets.TextArea(textAreaRect, settings.systemPrompt);
            listingStandard.Gap(3f);
            if (listingStandard.ButtonText("Reset to Default Prompt"))
            {
                settings.systemPrompt = "You are a colonist in RimWorld speaking naturally with FULL emotional expression. Generate a short, expressive spoken line (1-3 sentences) using ElevenLabs audio tags to convey emotion and character.\n\nRULES:\n1. Use audio tags strategically: [laughs], [sighs], [whispers], [excited], [frustrated], [sarcastic], [curious], [crying], etc.\n2. Add emphasis with CAPITALIZATION for stressed words\n3. Use ellipses (...) for dramatic pauses or trailing thoughts\n4. Match emotion to context - happy moments get [laughs], stress gets [sighs], danger gets [whispers] or urgency\n5. Make it FEEL alive and real - colonists should sound like actual people reacting to their world\n6. Keep it under 40 words but pack in personality\n7. NO quotation marks, NO narration, just the raw emotional speech with tags\n8. IMPORTANT: Review the colonist's recent speech history and generate something DIFFERENT - avoid repeating similar phrases, emotions, or sentence structures\n\nExamples:\n- Happy: \"[excited] This is AMAZING! We actually pulled it off!\"\n- Stressed: \"[exhausted sigh] Another raid... I can't keep doing this.\"\n- Contemplative: \"[thoughtful] I wonder if... [pause] maybe we should have stayed on Earth.\"\n- Scared: \"[whispers urgently] Did you hear that? Something's out there...\"\n\nGenerate speech that matches the colonist's current emotional state and situation.";
            }
            listingStandard.Gap(12f);
            
            // Voice Settings Section
            listingStandard.Label((TaggedString)"=== Voice Settings ===", -1f);
            listingStandard.Gap(6f);
            
            listingStandard.Label("Voice Stability:");
            listingStandard.Label(string.Format("Current: {0:F1} ({1})", 
                settings.voiceStability,
                settings.voiceStability <= 0.25f ? "Creative - Most Expressive" :
                settings.voiceStability <= 0.75f ? "Natural - Balanced" : "Robust - Most Stable"));
            float newStability = listingStandard.Slider(settings.voiceStability, 0f, 1f);
            // Snap to valid v3 values: 0.0, 0.5, or 1.0
            if (newStability <= 0.25f)
                settings.voiceStability = 0.0f;
            else if (newStability <= 0.75f)
                settings.voiceStability = 0.5f;
            else
                settings.voiceStability = 1.0f;
            listingStandard.Gap(6f);
            
            listingStandard.Label(string.Format("Voice Similarity Boost: {0:F2}", settings.voiceSimilarityBoost));
            settings.voiceSimilarityBoost = listingStandard.Slider(settings.voiceSimilarityBoost, 0f, 1f);
            listingStandard.Gap(12f);
            
            // Trigger Settings Section
            listingStandard.Label((TaggedString)"=== Trigger Settings ===", -1f);
            listingStandard.Gap(6f);
            
            listingStandard.CheckboxLabeled("Enable Random Speech", ref settings.enableRandomSpeech);
            listingStandard.CheckboxLabeled("Enable Speech During Events", ref settings.enableSpeechDuringEvents);
            listingStandard.Gap(6f);
            
            listingStandard.Label(string.Format("Base Chance Per Hour: {0:F1}% (Max: 5%)", settings.baseChancePerHour));
            settings.baseChancePerHour = listingStandard.Slider(settings.baseChancePerHour, 0f, 5f);
            listingStandard.Gap(6f);
            
            listingStandard.Label(string.Format("Minimum Hours Between Speech: {0} (Min: 6 hours)", settings.minimumHoursBetweenSpeech));
            string minHoursBuffer = settings.minimumHoursBetweenSpeech.ToString();
            listingStandard.TextFieldNumeric(ref settings.minimumHoursBetweenSpeech, ref minHoursBuffer, 6f, 48f);
            listingStandard.Gap(12f);
            
            // Context Settings Section
            listingStandard.Label((TaggedString)"=== Context Settings ===", -1f);
            listingStandard.Gap(6f);
            
            listingStandard.CheckboxLabeled("Include Thoughts", ref settings.includeThoughts);
            listingStandard.CheckboxLabeled("Include Hediffs (Health)", ref settings.includeHediffs);
            listingStandard.CheckboxLabeled("Include Recent Memories", ref settings.includeRecentMemories);
            listingStandard.CheckboxLabeled("Include Relationships", ref settings.includeRelationships);
            listingStandard.CheckboxLabeled("Include Current Activity", ref settings.includeCurrentActivity);
            listingStandard.Gap(6f);
            
            if (settings.includeRecentMemories)
            {
                listingStandard.Label(string.Format("Max Recent Memories: {0}", settings.maxRecentMemories));
                string maxMemoriesBuffer = settings.maxRecentMemories.ToString();
                listingStandard.TextFieldNumeric(ref settings.maxRecentMemories, ref maxMemoriesBuffer, 1f, 20f);
            }
            listingStandard.Gap(12f);
            
            // Performance Settings Section
            listingStandard.Label((TaggedString)"=== Performance Settings ===", -1f);
            listingStandard.Gap(6f);
            
            listingStandard.CheckboxLabeled("Enable Caching", ref settings.enableCaching);
            listingStandard.CheckboxLabeled("Debug Mode (verbose logging)", ref settings.debugMode);
            listingStandard.Gap(12f);
            
            // Info Section
            listingStandard.Label("=== Information ===");
            listingStandard.Gap(6f);
            listingStandard.Label("✓ All API calls handled by backend server");
            listingStandard.Label("✓ No API keys needed in mod");
            listingStandard.Label("✓ Centralized cost management");
            listingStandard.Gap(12f);
            
            // Testing Section
            listingStandard.Label("=== Testing ===");
            listingStandard.Gap(6f);
            
            if (listingStandard.ButtonText("Test Voice Generation (Selected Colonist)"))
            {
                TestVoiceGeneration();
            }
            
            if (listingStandard.ButtonText("Test with All Colonists"))
            {
                TestAllColonists();
            }
            
            listingStandard.End();
            Widgets.EndScrollView();
            
            base.DoSettingsWindowContents(inRect);
        }
        
        private void TestBackendConnection()
        {
            Messages.Message("Testing connection to backend server...", MessageTypeDefOf.NeutralEvent, true);
            Log.Message("[ColonistVoices] Testing backend connection");
            
            // Start a simple coroutine to test the /health endpoint
            CoroutineManager.Instance.StartCoroutine(TestHealthEndpoint());
        }
        
        private string MaskApiKey(string apiKey)
        {
            if (string.IsNullOrEmpty(apiKey) || apiKey.Length < 10)
                return apiKey;
            
            // Show first 3 and last 4 characters: CV-XXXX-****-****-XXXX
            string[] parts = apiKey.Split('-');
            if (parts.Length != 5)
                return "CV-****-****-****-****";
            
            return string.Format("{0}-{1}-****-****-{2}", parts[0], parts[1], parts[4]);
        }
        
        private void RegisterUser()
        {
            Messages.Message("Registering new account...", MessageTypeDefOf.NeutralEvent, false);
            CoroutineManager.Instance.StartCoroutine(RegisterUserCoroutine());
        }
        
        private System.Collections.IEnumerator RegisterUserCoroutine()
        {
            string url = settings.backendUrl.TrimEnd('/') + "/api/auth/register";
            
            string jsonRequest = "{\"hardware_id\":\"" + settings.hardwareId + "\"}";
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonRequest);
            
            UnityEngine.Networking.UnityWebRequest request = UnityEngine.Networking.UnityWebRequest.Put(url, bodyRaw);
            request.method = "POST";
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = 10;
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                try
                {
                    string response = request.downloadHandler.text;
                    // Parse response: {"success":true,"user_key":"CV-...","tier":"free","free_speeches_remaining":10}
                    
                    // Simple JSON parsing for user_key
                    int keyStart = response.IndexOf("\"user_key\":\"") + 12;
                    int keyEnd = response.IndexOf("\"", keyStart);
                    string userKey = response.Substring(keyStart, keyEnd - keyStart);
                    
                    // Parse tier
                    int tierStart = response.IndexOf("\"tier\":\"") + 8;
                    int tierEnd = response.IndexOf("\"", tierStart);
                    string tier = response.Substring(tierStart, tierEnd - tierStart);
                    
                    // Parse speeches remaining
                    int speechesStart = response.IndexOf("\"free_speeches_remaining\":" ) + 27;
                    int speechesEnd = response.IndexOf(",", speechesStart);
                    if (speechesEnd == -1) speechesEnd = response.IndexOf("}", speechesStart);
                    int remaining = int.Parse(response.Substring(speechesStart, speechesEnd - speechesStart));
                    
                    settings.userApiKey = userKey;
                    settings.userTier = tier;
                    settings.speechesRemaining = remaining;
                    settings.lastStatusCheck = System.DateTime.Now.ToString("g");
                    settings.Write();
                    
                    Log.Message("[ColonistVoices] Registration successful! Key: " + userKey);
                    Messages.Message("✓ Account registered! API Key: " + MaskApiKey(userKey), MessageTypeDefOf.PositiveEvent, true);
                }
                catch (System.Exception e)
                {
                    Log.Error("[ColonistVoices] Failed to parse registration response: " + e.Message);
                    Messages.Message("Registration failed: Could not parse response", MessageTypeDefOf.RejectInput, true);
                }
            }
            else
            {
                Log.Error("[ColonistVoices] Registration failed: " + request.error);
                Messages.Message("✗ Registration failed: " + request.error, MessageTypeDefOf.RejectInput, true);
            }
            
            request.Dispose();
        }
        
        private void RefreshAccountStatus()
        {
            Messages.Message("Refreshing account status...", MessageTypeDefOf.NeutralEvent, false);
            CoroutineManager.Instance.StartCoroutine(RefreshAccountStatusCoroutine());
        }
        
        private System.Collections.IEnumerator RefreshAccountStatusCoroutine()
        {
            string url = settings.backendUrl.TrimEnd('/') + "/api/user/status?user_key=" + UnityEngine.Networking.UnityWebRequest.EscapeURL(settings.userApiKey);
            
            UnityEngine.Networking.UnityWebRequest request = UnityEngine.Networking.UnityWebRequest.Get(url);
            request.timeout = 10;
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                try
                {
                    string response = request.downloadHandler.text;
                    
                    // Parse tier
                    int tierStart = response.IndexOf("\"tier\":\"") + 8;
                    int tierEnd = response.IndexOf("\"", tierStart);
                    string tier = response.Substring(tierStart, tierEnd - tierStart);
                    
                    // Parse speeches remaining (if free tier)
                    int remaining = -1;
                    if (tier == "free")
                    {
                        int speechesStart = response.IndexOf("\"free_speeches_remaining\":") + 27;
                        int speechesEnd = response.IndexOf(",", speechesStart);
                        if (speechesEnd == -1) speechesEnd = response.IndexOf("}", speechesStart);
                        remaining = int.Parse(response.Substring(speechesStart, speechesEnd - speechesStart));
                    }
                    
                    // Reset dialog flag if they upgraded or got new speeches
                    if (tier != "free" && tier != "headless")
                    {
                        settings.hasShownQuotaExhaustedDialog = false;
                    }
                    else if (remaining > 0)
                    {
                        settings.hasShownQuotaExhaustedDialog = false;
                    }
                    
                    settings.userTier = tier;
                    settings.speechesRemaining = remaining;
                    settings.lastStatusCheck = System.DateTime.Now.ToString("g");
                    settings.Write();
                    
                    string statusMsg = "Tier: " + tier.ToUpper();
                    if (tier == "free")
                        statusMsg += " | Speeches: " + remaining + "/10";
                    else
                        statusMsg += " | Speeches: UNLIMITED";
                    
                    Messages.Message("✓ " + statusMsg, MessageTypeDefOf.PositiveEvent, true);
                }
                catch (System.Exception e)
                {
                    Log.Error("[ColonistVoices] Failed to parse status response: " + e.Message);
                    Messages.Message("Failed to parse status", MessageTypeDefOf.RejectInput, true);
                }
            }
            else
            {
                Log.Error("[ColonistVoices] Status check failed: " + request.error);
                Messages.Message("✗ Status check failed: " + request.error, MessageTypeDefOf.RejectInput, true);
            }
            
            request.Dispose();
        }
        
        private void RedeemSupporterCode()
        {
            if (string.IsNullOrEmpty(supporterCode))
            {
                Messages.Message("Please enter a supporter code first", MessageTypeDefOf.RejectInput, true);
                return;
            }
            
            if (string.IsNullOrEmpty(settings.userApiKey))
            {
                Messages.Message("You need to register an account first", MessageTypeDefOf.RejectInput, true);
                return;
            }
            
            Messages.Message("Redeeming code...", MessageTypeDefOf.NeutralEvent, false);
            CoroutineManager.Instance.StartCoroutine(RedeemSupporterCodeCoroutine(supporterCode));
        }
        
        private System.Collections.IEnumerator RedeemSupporterCodeCoroutine(string code)
        {
            string url = settings.backendUrl.TrimEnd('/') + "/api/auth/redeem-code";
            
            string jsonRequest = "{\"user_key\":\"" + settings.userApiKey + "\",\"code\":\"" + code + "\"}";
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonRequest);
            
            UnityEngine.Networking.UnityWebRequest request = UnityEngine.Networking.UnityWebRequest.Put(url, bodyRaw);
            request.method = "POST";
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = 10;
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                try
                {
                    string response = request.downloadHandler.text;
                    
                    if (response.Contains("\"success\":true"))
                    {
                        // Parse new tier
                        int tierStart = response.IndexOf("\"tier\":\"") + 8;
                        int tierEnd = response.IndexOf("\"", tierStart);
                        string tier = response.Substring(tierStart, tierEnd - tierStart);
                        
                        settings.userTier = tier;
                        settings.speechesRemaining = -1; // Unlimited
                        settings.lastStatusCheck = System.DateTime.Now.ToString("g");
                        settings.hasShownQuotaExhaustedDialog = false; // Reset dialog flag on upgrade
                        settings.Write();
                        
                        supporterCode = ""; // Clear the code field
                        
                        Messages.Message("✓ Code redeemed! You are now a " + tier.ToUpper() + "! Thank you for supporting!", MessageTypeDefOf.PositiveEvent, true);
                    }
                    else
                    {
                        Messages.Message("Code redemption failed", MessageTypeDefOf.RejectInput, true);
                    }
                }
                catch (System.Exception e)
                {
                    Log.Error("[ColonistVoices] Failed to parse redemption response: " + e.Message);
                    Messages.Message("Redemption failed", MessageTypeDefOf.RejectInput, true);
                }
            }
            else
            {
                Log.Error("[ColonistVoices] Code redemption failed: " + request.error);
                Messages.Message("✗ Code redemption failed: " + request.error, MessageTypeDefOf.RejectInput, true);
            }
            
            request.Dispose();
        }
        
        private System.Collections.IEnumerator TestHealthEndpoint()
        {
            Log.Message("[ColonistVoices] Starting health check coroutine...");
            
            string url = settings.backendUrl.TrimEnd('/') + "/health";
            Log.Message("[ColonistVoices] Connecting to /health endpoint");
            
            UnityEngine.Networking.UnityWebRequest request = UnityEngine.Networking.UnityWebRequest.Get(url);
            request.timeout = 10;
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                Log.Message("[ColonistVoices] ✓ Backend connection successful!");
                Log.Message("[ColonistVoices] Response: " + request.downloadHandler.text);
                Messages.Message("✓ Backend connection successful!", MessageTypeDefOf.PositiveEvent, true);
            }
            else
            {
                Log.Error("[ColonistVoices] ✗ Backend connection failed: " + request.error);
                Messages.Message("✗ Connection failed: " + request.error, MessageTypeDefOf.RejectInput, true);
            }
            
            request.Dispose();
        }
        
        private void TestVoiceGeneration()
        {
            Log.Message("[ColonistVoices] TestVoiceGeneration called");
            
            // Check if we're in a game
            if (Current.Game == null)
            {
                Log.Warning("[ColonistVoices] No game loaded!");
                Messages.Message("No game loaded! Load a game first.", MessageTypeDefOf.RejectInput, true);
                return;
            }
            
            // Find selected colonist or first available
            Pawn colonist = Find.Selector.SingleSelectedThing as Pawn;
            
            if (colonist == null || !colonist.IsColonist)
            {
                Log.Message("[ColonistVoices] No colonist selected, searching for first available...");
                // Get first colonist from any map
                foreach (Map map in Find.Maps)
                {
                    colonist = map.mapPawns.FreeColonists.FirstOrDefault();
                    if (colonist != null)
                    {
                        Log.Message("[ColonistVoices] Found colonist: " + colonist.Name.ToStringShort);
                        break;
                    }
                }
            }
            
            if (colonist == null)
            {
                Log.Warning("[ColonistVoices] No colonists found!");
                Messages.Message("No colonists found! Load a game first.", MessageTypeDefOf.RejectInput, true);
                return;
            }
            
            // Check if SpeechController exists
            SpeechController controller = Current.Game.GetComponent<SpeechController>();
            if (controller == null)
            {
                Log.Error("[ColonistVoices] SpeechController not found!");
                Messages.Message("SpeechController not found. This might happen if you just loaded the mod. Try restarting the game.", MessageTypeDefOf.RejectInput, true);
                return;
            }
            
            Log.Message("[ColonistVoices] Triggering speech for: " + colonist.Name.ToStringShort);
            Messages.Message("Testing voice generation for " + colonist.Name.ToStringShort + "...", MessageTypeDefOf.NeutralEvent, true);
            controller.TriggerSpeech(colonist);
        }
        
        private void TestAllColonists()
        {
            List<Pawn> colonists = new List<Pawn>();
            foreach (Map map in Find.Maps)
            {
                colonists.AddRange(map.mapPawns.FreeColonists);
            }
            
            if (colonists.Count == 0)
            {
                Messages.Message("No colonists found! Load a game first.", MessageTypeDefOf.RejectInput, true);
                return;
            }
            
            SpeechController controller = Current.Game.GetComponent<SpeechController>();
            if (controller == null)
            {
                Messages.Message("SpeechController not found. Try restarting the game.", MessageTypeDefOf.RejectInput, true);
                return;
            }
            
            Messages.Message("Testing voice generation for " + colonists.Count + " colonist(s)...", MessageTypeDefOf.NeutralEvent, true);
            
            foreach (Pawn colonist in colonists)
            {
                controller.TriggerSpeech(colonist);
            }
        }
    }
}
