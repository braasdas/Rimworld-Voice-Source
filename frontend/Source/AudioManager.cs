using UnityEngine;
using Verse;
using RimWorld;

namespace ColonistVoices
{
    public class AudioManager : MonoBehaviour
    {
        private static AudioManager instance;
        private AudioSource audioSource;
        
        public static AudioManager Instance
        {
            get
            {
                if (instance == null)
                {
                    GameObject go = new GameObject("ColonistVoicesAudioManager");
                    instance = go.AddComponent<AudioManager>();
                    DontDestroyOnLoad(go);
                }
                return instance;
            }
        }
        
        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }
            
            instance = this;
            audioSource = gameObject.AddComponent<AudioSource>();
            audioSource.spatialBlend = 0f; // 2D sound
            audioSource.volume = 0.7f;
            DontDestroyOnLoad(gameObject);
        }
        
        public void PlayAudio(AudioClip clip, Pawn colonist, string speechText, System.Action onComplete = null)
        {
            if (clip == null)
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Warning("[ColonistVoices] Attempted to play null audio clip");
                if (onComplete != null)
                    onComplete();
                return;
            }
            
            if (audioSource.isPlaying)
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Message("[ColonistVoices] Audio already playing, skipping...");
                if (onComplete != null)
                    onComplete();
                return;
            }
            
            audioSource.clip = clip;
            audioSource.Play();
            
            // Show a mote or indicator above the colonist with the speech text
            ShowSpeechIndicator(colonist, speechText, clip.length);
            
            if (ColonistVoicesMod.settings.debugMode)
                Log.Message(string.Format("[ColonistVoices] Playing audio for {0} (duration: {1:F1}s)", colonist.Name.ToStringShort, clip.length));
            
            // Start coroutine to wait for audio to finish, then call onComplete
            if (onComplete != null)
            {
                CoroutineManager.Instance.StartCoroutine(WaitForAudioComplete(clip.length, onComplete));
            }
        }
        
        private System.Collections.IEnumerator WaitForAudioComplete(float duration, System.Action onComplete)
        {
            // Wait for the audio duration
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                yield return null;
            }
            
            if (ColonistVoicesMod.settings.debugMode)
                Log.Message("[ColonistVoices] Audio playback complete");
            
            // Call the completion callback
            if (onComplete != null)
                onComplete();
        }
        
        private void ShowSpeechIndicator(Pawn colonist, string speechText, float duration)
        {
            try
            {
                // Create a speech bubble mote above the colonist
                if (colonist.Spawned && colonist.Map != null)
                {
                    Vector3 drawPos = colonist.DrawPos;
                    drawPos.z += 1.5f; // Move it above the colonist
                    drawPos.y = AltitudeLayer.MetaOverlays.AltitudeFor();
                    
                    // Create a speech bubble with the actual text
                    // Truncate if too long
                    string displayText = speechText;
                    if (displayText.Length > 100)
                    {
                        displayText = displayText.Substring(0, 97) + "...";
                    }
                    
                    // Add speech bubble emoji at the start
                    displayText = "💬 " + displayText;
                    
                    // Use a longer duration based on audio length, minimum 3 seconds
                    float displayDuration = Mathf.Max(duration, 3f);
                    
                    MoteMaker.ThrowText(drawPos, colonist.Map, displayText, Color.white, displayDuration);
                }
            }
            catch (System.Exception e)
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Warning(string.Format("[ColonistVoices] Error showing speech indicator: {0}", e.Message));
            }
        }
        
        public bool IsPlaying()
        {
            return audioSource != null && audioSource.isPlaying;
        }
    }
}
