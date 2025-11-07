using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Verse;

namespace ColonistVoices
{
    /// <summary>
    /// Certificate handler that accepts all certificates (for HTTP connections)
    /// </summary>
    public class AcceptAllCertificates : CertificateHandler
    {
        protected override bool ValidateCertificate(byte[] certificateData)
        {
            return true; // Accept all certificates for HTTP
        }
    }

    /// <summary>
    /// Handles communication with the backend server for speech generation
    /// </summary>
    public static class BackendAPIHandler
    {
        [Serializable]
        public class SpeechRequest
        {
            public string user_key; // OPTIONAL - if not provided, uses headless mode
            public string context;
            public string system_prompt;
            public string model;
            public string voice_id;
            public VoiceSettingsJson voice_settings;
        }

        [Serializable]
        public class VoiceSettingsJson
        {
            public float stability;
            public float similarity_boost;
        }

        [Serializable]
        public class SpeechResponse
        {
            public bool success;
            public string speech_text;
            public string audio_data; // base64
            public int processing_time_ms;
            public int speeches_remaining; // -1 if unlimited
            public string tier;
            public string error;
        }

        public static IEnumerator GenerateSpeech(
            string context,
            string systemPrompt,
            string model,
            string voiceId,
            float stability,
            float similarityBoost,
            Action<AudioClip, string> onSuccess,
            Action<string> onError)
        {
            var settings = ColonistVoicesMod.settings;

            Log.Message("[ColonistVoices] BackendAPIHandler.GenerateSpeech called");

            if (string.IsNullOrEmpty(settings.backendUrl))
            {
                Log.Error("[ColonistVoices] Backend URL is empty!");
                onError("Backend URL not configured. Please set it in Mod Settings.");
                yield break;
            }

            // URL censored for security
            Log.Message("[ColonistVoices] Using configured backend server");
            
            // Build request object
            Log.Message("[ColonistVoices] Building request object...");
            SpeechRequest requestData = new SpeechRequest
            {
                user_key = string.IsNullOrEmpty(settings.userApiKey) ? null : settings.userApiKey,
                context = context,
                system_prompt = systemPrompt,
                model = model,
                voice_id = voiceId,
                voice_settings = new VoiceSettingsJson
                {
                    stability = stability,
                    similarity_boost = similarityBoost
                }
            };
            
            if (string.IsNullOrEmpty(settings.userApiKey))
            {
                Log.Message("[ColonistVoices] Using headless mode (no API key)");
            }
            else
            {
                Log.Message("[ColonistVoices] Using authenticated mode with API key");
            }

            // Serialize to JSON
            Log.Message("[ColonistVoices] Serializing to JSON...");
            string jsonRequest = JsonUtility.ToJson(requestData);
            Log.Message(string.Format("[ColonistVoices] JSON length: {0} chars", jsonRequest.Length));
            
            byte[] bodyRaw = GetBytesUtf8(jsonRequest);
            Log.Message(string.Format("[ColonistVoices] Body bytes: {0}", bodyRaw.Length));

            // Create request using Post method to avoid Span issues
            string endpoint = settings.backendUrl.TrimEnd('/') + "/api/speech/generate";
            Log.Message("[ColonistVoices] Connecting to /api/speech/generate endpoint");
            
            UnityWebRequest request = UnityWebRequest.Put(endpoint, bodyRaw);
            request.method = "POST";
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = 30; // 30 second timeout
            
            // Critical fix for hanging requests
            request.useHttpContinue = false;
            
            // Add certificate handler for HTTP connections
            request.certificateHandler = new AcceptAllCertificates();
            request.disposeCertificateHandlerOnDispose = true;
            
            Log.Message("[ColonistVoices] UnityWebRequest created with useHttpContinue=false");

            if (settings.debugMode)
            {
                Log.Message(string.Format("[ColonistVoices] Request JSON preview: {0}...", jsonRequest.Substring(0, Mathf.Min(500, jsonRequest.Length))));
            }

            Log.Message("[ColonistVoices] Calling request.SendWebRequest()...");
            
            yield return request.SendWebRequest();
            
            Log.Message("[ColonistVoices] SendWebRequest completed!");
            
            Log.Message(string.Format("[ColonistVoices] Request result: {0}", request.result));
            Log.Message(string.Format("[ColonistVoices] Response code: {0}", request.responseCode));
            Log.Message(string.Format("[ColonistVoices] Error (if any): {0}", request.error ?? "none"));

            if (request.result == UnityWebRequest.Result.Success)
            {
                Log.Message("[ColonistVoices] Request succeeded!");
                string responseText = request.downloadHandler.text;

                Log.Message(string.Format("[ColonistVoices] Response length: {0} chars", responseText.Length));

                // Parse response
                SpeechResponse response = null;
                bool parseSuccess = false;
                
                try
                {
                    Log.Message("[ColonistVoices] Parsing JSON response...");
                    response = JsonUtility.FromJson<SpeechResponse>(responseText);
                    parseSuccess = true;
                    Log.Message("[ColonistVoices] JSON parsed successfully");
                }
                catch (Exception e)
                {
                    Log.Error(string.Format("[ColonistVoices] Failed to parse response: {0}", e.Message));
                    Log.Error(string.Format("[ColonistVoices] Response text: {0}", responseText.Substring(0, Mathf.Min(1000, responseText.Length))));
                    onError(string.Format("Failed to parse backend response: {0}", e.Message));
                    request.Dispose();
                    yield break;
                }

                if (parseSuccess && response != null && response.success)
                {
                    Log.Message("[ColonistVoices] Response indicates success!");
                    Log.Message(string.Format("[ColonistVoices] Speech text: '{0}'", response.speech_text));
                    Log.Message(string.Format("[ColonistVoices] Audio data length: {0} chars (base64)", response.audio_data.Length));
                    Log.Message(string.Format("[ColonistVoices] Processing time: {0}ms", response.processing_time_ms));
                    
                    // Update cached usage stats
                    if (!string.IsNullOrEmpty(response.tier))
                    {
                        settings.userTier = response.tier;
                        settings.speechesRemaining = response.speeches_remaining;
                        settings.lastStatusCheck = System.DateTime.Now.ToString("g");
                        settings.Write();
                        
                        Log.Message(string.Format("[ColonistVoices] Updated usage: Tier={0}, Remaining={1}", 
                            response.tier, response.speeches_remaining));
                        
                        // Show quota exhausted dialog if they just used their last speech
                        if ((response.tier == "free" || response.tier == "headless") && response.speeches_remaining == 0)
                        {
                            Log.Message("[ColonistVoices] Free quota exhausted, showing dialog");
                            ColonistVoicesMod.ShowQuotaExhaustedDialog();
                        }
                    }

                    // Convert base64 to bytes
                    byte[] audioData = null;
                    bool decodeSuccess = false;
                    
                    try
                    {
                        Log.Message("[ColonistVoices] Decoding base64 audio data...");
                        audioData = Convert.FromBase64String(response.audio_data);
                        decodeSuccess = true;
                        Log.Message(string.Format("[ColonistVoices] Decoded to {0} bytes", audioData.Length));
                    }
                    catch (Exception e)
                    {
                        Log.Error(string.Format("[ColonistVoices] Failed to decode: {0}", e.Message));
                        onError(string.Format("Failed to decode audio data: {0}", e.Message));
                        request.Dispose();
                        yield break;
                    }

                    if (decodeSuccess && audioData != null)
                    {
                        Log.Message("[ColonistVoices] Starting LoadAudioFromBytes coroutine...");
                        
                        // Save to temp file and load as AudioClip
                        IEnumerator loadCoroutine = LoadAudioFromBytes(audioData, response.speech_text, onSuccess, onError);
                        while (loadCoroutine.MoveNext())
                        {
                            yield return loadCoroutine.Current;
                        }
                        
                        Log.Message("[ColonistVoices] LoadAudioFromBytes completed");
                    }
                }
                else if (response != null)
                {
                    string errorMsg = response.error ?? "Unknown error";
                    Log.Error(string.Format("[ColonistVoices] Backend returned error: {0}", errorMsg));
                    onError(string.Format("Backend error: {0}", errorMsg));
                }
                else
                {
                    Log.Error("[ColonistVoices] Response was null after parsing");
                    onError("Backend returned null response");
                }
            }
            else
            {
                Log.Error("[ColonistVoices] Request failed!");
                string errorMsg = string.Format("Backend connection failed: {0}", request.error);
                if (!string.IsNullOrEmpty(request.downloadHandler.text))
                {
                    errorMsg += string.Format("\nResponse: {0}", request.downloadHandler.text);
                    Log.Error(string.Format("[ColonistVoices] Response body: {0}", request.downloadHandler.text));
                }

                Log.Error(string.Format("[ColonistVoices] {0}", errorMsg));
                onError(errorMsg);
            }

            Log.Message("[ColonistVoices] Disposing request...");
            request.Dispose();
            Log.Message("[ColonistVoices] BackendAPIHandler.GenerateSpeech finished");
        }

        private static IEnumerator LoadAudioFromBytes(byte[] audioData, string speechText, Action<AudioClip, string> onSuccess, Action<string> onError)
        {
            // Save to temp file
            Guid guid = Guid.NewGuid();
            string tempPath = System.IO.Path.Combine(Application.temporaryCachePath, string.Format("voice_{0}.mp3", guid));

            bool writeSuccess = false;
            string writeError = null;
            
            try
            {
                System.IO.File.WriteAllBytes(tempPath, audioData);
                writeSuccess = true;

                if (ColonistVoicesMod.settings.debugMode)
                {
                    Log.Message(string.Format("[ColonistVoices] Wrote temp file: {0}", tempPath));
                }
            }
            catch (Exception e)
            {
                writeError = e.Message;
            }

            if (!writeSuccess)
            {
                onError(string.Format("Failed to write temp audio file: {0}", writeError));
                yield break;
            }

            // Load audio file
            string fileUrl = "file:///" + tempPath;
            UnityWebRequest audioRequest = UnityWebRequestMultimedia.GetAudioClip(fileUrl, AudioType.MPEG);

            yield return audioRequest.SendWebRequest();

            if (audioRequest.result == UnityWebRequest.Result.Success)
            {
                AudioClip clip = DownloadHandlerAudioClip.GetContent(audioRequest);
                
                if (clip != null)
                {
                    if (ColonistVoicesMod.settings.debugMode)
                    {
                        Log.Message(string.Format("[ColonistVoices] \u2713 Audio clip loaded successfully ({0}s)", clip.length));
                    }
                    
                    onSuccess(clip, speechText);
                }
                else
                {
                    onError("Failed to load audio clip from temp file");
                }
            }
            else
            {
                onError(string.Format("Failed to load audio: {0}", audioRequest.error));
            }

            // Cleanup
            audioRequest.Dispose();
            
            try
            {
                if (System.IO.File.Exists(tempPath))
                {
                    System.IO.File.Delete(tempPath);
                }
            }
            catch
            {
                // Ignore cleanup errors
            }
        }

        private static byte[] GetBytesUtf8(string str)
        {
            if (str == null)
                return new byte[0];

            return new UTF8Encoding(false).GetBytes(str.ToCharArray());
        }
    }
}
