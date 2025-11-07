using System;
using System.Collections.Generic;
using System.Linq;
using Verse;
using RimWorld;

namespace ColonistVoices
{
    /// <summary>
    /// Voice selection using DEFAULT/PREMADE ElevenLabs voices that DON'T count toward custom voice limit
    /// </summary>
    public static class VoiceSelector
    {
        // Voice database organized by characteristics - USING DEFAULT (PREMADE) VOICES ONLY
        // These voices DO NOT count toward the 3 custom voice limit on free tier!
        private static readonly Dictionary<string, VoiceProfile> voiceDatabase = new Dictionary<string, VoiceProfile>
        {
            // MALE VOICES - Young (18-30)
            { "TxGEqnHWrfWFTfGW9XjX", new VoiceProfile("Josh", Gender.Male, AgeRange.Young, new[] { "young", "conversational", "casual" }) },
            { "g5CIjZEefAph4nQFvHAz", new VoiceProfile("Ethan", Gender.Male, AgeRange.Young, new[] { "young", "clear" }) },
            { "D38z5RcWu1voky8WS1ja", new VoiceProfile("Fin", Gender.Male, AgeRange.Young, new[] { "young", "friendly" }) },
            { "TX3LPaxmHKxFdv7VOQHJ", new VoiceProfile("Liam", Gender.Male, AgeRange.Young, new[] { "young", "energetic" }) },
            { "wViXBPUzp2ZZixB1xQuM", new VoiceProfile("Ryan", Gender.Male, AgeRange.Young, new[] { "young", "casual" }) },
            { "yoZ06aMxZJJ28mfd3POQ", new VoiceProfile("Sam", Gender.Male, AgeRange.Young, new[] { "young", "friendly" }) },
            
            // MALE VOICES - Adult (30-50)
            { "ErXwobaYiN019PkySvjV", new VoiceProfile("Antoni", Gender.Male, AgeRange.Adult, new[] { "well-rounded", "conversational", "professional" }) },
            { "pNInz6obpgDQGcFmaJgB", new VoiceProfile("Adam", Gender.Male, AgeRange.Adult, new[] { "deep", "confident", "narration" }) },
            { "ZQe5CZNOzWyzPSCn5a3c", new VoiceProfile("James", Gender.Male, AgeRange.Adult, new[] { "calm", "professional" }) },
            { "Yko7PKHZNXotIFUBG7I9", new VoiceProfile("Matthew", Gender.Male, AgeRange.Adult, new[] { "clear", "professional" }) },
            { "flq6f7yk4E4fJM5XTYuZ", new VoiceProfile("Michael", Gender.Male, AgeRange.Adult, new[] { "authoritative", "confident" }) },

            // MALE VOICES - Elderly (50+)
            { "VR6AewLTigWG4xSOukaG", new VoiceProfile("Arnold", Gender.Male, AgeRange.Elderly, new[] { "mature", "gravelly", "experienced" }) },
            { "zcAOhNBS3c14rBihAFp1", new VoiceProfile("Giovanni", Gender.Male, AgeRange.Elderly, new[] { "mature", "warm" }) },
            { "SOYHLrjzK2X1ezoPC6cr", new VoiceProfile("Harry", Gender.Male, AgeRange.Elderly, new[] { "mature", "wise" }) },
            { "bVMeCyTHy58xNoL34h3p", new VoiceProfile("Jeremy", Gender.Male, AgeRange.Elderly, new[] { "mature", "calm" }) },
            { "Zlb1dXrM653N07WRdFW3", new VoiceProfile("Joseph", Gender.Male, AgeRange.Elderly, new[] { "mature", "friendly" }) },
            { "ODq5zmih8GrVes37Dizd", new VoiceProfile("Patrick", Gender.Male, AgeRange.Elderly, new[] { "mature", "experienced" }) },

            // FEMALE VOICES - Young (18-30)
            { "EXAVITQu4vr4xnSDxMaL", new VoiceProfile("Bella", Gender.Female, AgeRange.Young, new[] { "soft", "conversational", "american" }) },
            { "MF3mGyEYCl7XYWbV9V6O", new VoiceProfile("Elli", Gender.Female, AgeRange.Young, new[] { "young", "conversational", "friendly" }) },
            { "LcfcDJNUP1GQjkzn1xUU", new VoiceProfile("Emily", Gender.Female, AgeRange.Young, new[] { "young", "calm" }) },
            { "jsCqWAovK2LkecY7zXl4", new VoiceProfile("Freya", Gender.Female, AgeRange.Young, new[] { "young", "pleasant" }) },
            { "jBpfuIE2acCO8z3wKNLl", new VoiceProfile("Gigi", Gender.Female, AgeRange.Young, new[] { "young", "cheerful" }) },
            { "t0jbNlBVZ17f02VDIeMI", new VoiceProfile("Jessie", Gender.Female, AgeRange.Young, new[] { "young", "energetic" }) },
            { "zrHiDhphv9ZnVXBqCLjz", new VoiceProfile("Mimi", Gender.Female, AgeRange.Young, new[] { "young", "sweet" }) },

            // FEMALE VOICES - Adult (30-50)
            { "21m00Tcm4TlvDq8ikWAM", new VoiceProfile("Rachel", Gender.Female, AgeRange.Adult, new[] { "mellow", "conversational", "american", "calm" }) },
            { "AZnzlk1XvdvUeBnXmlld", new VoiceProfile("Domi", Gender.Female, AgeRange.Adult, new[] { "engaged", "dynamic", "american", "energetic" }) },
            { "oWAxZDx7w5VEj9dCyTzz", new VoiceProfile("Grace", Gender.Female, AgeRange.Adult, new[] { "professional", "calm" }) },
            { "piTKgcLEGmPE4e6mEKli", new VoiceProfile("Nicole", Gender.Female, AgeRange.Adult, new[] { "confident", "professional" }) },
            { "pMsXgVXv3BLzUgSXRplE", new VoiceProfile("Serena", Gender.Female, AgeRange.Adult, new[] { "calm", "warm" }) },

            // FEMALE VOICES - Elderly (50+)
            { "ThT5KcBeYPX3keUQqHPh", new VoiceProfile("Dorothy", Gender.Female, AgeRange.Elderly, new[] { "mature", "pleasant", "grandmother" }) },
            { "z9fAnlkpzviPz146aGWa", new VoiceProfile("Glinda", Gender.Female, AgeRange.Elderly, new[] { "mature", "wise" }) },
            { "XrExE9yKIg1WjnnlVkGX", new VoiceProfile("Matilda", Gender.Female, AgeRange.Elderly, new[] { "mature", "warm" }) }
        };
        
        public static string SelectVoiceForColonist(Pawn colonist)
        {
            try
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Message("[ColonistVoices] SelectVoiceForColonist called for " + colonist.Name.ToStringShort);
                
                // Check if colonist already has an assigned voice
                if (ColonistVoicesMod.settings.colonistVoices.ContainsKey(colonist.ThingID))
                {
                    string cachedVoice = ColonistVoicesMod.settings.colonistVoices[colonist.ThingID];
                    
                    if (ColonistVoicesMod.settings.debugMode)
                        Log.Message("[ColonistVoices] Using cached voice: " + cachedVoice);
                    
                    // Verify the cached voice exists
                    if (voiceDatabase.ContainsKey(cachedVoice))
                    {
                        return cachedVoice;
                    }
                    else
                    {
                        Log.Warning("[ColonistVoices] Cached voice not found in database, selecting new one");
                        ColonistVoicesMod.settings.colonistVoices.Remove(colonist.ThingID);
                    }
                }
                
                // Get colonist characteristics
                Gender gender = colonist.gender;
                AgeRange ageRange = GetAgeRange(colonist);
                
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Message(string.Format("[ColonistVoices] Colonist - Gender: {0}, Age: {1} ({2} years)", 
                        gender, ageRange, colonist.ageTracker.AgeBiologicalYears));
                
                // Filter by BOTH gender and age
                List<string> candidates = new List<string>();
                foreach (var kvp in voiceDatabase)
                {
                    if (kvp.Value.gender == gender && kvp.Value.ageRange == ageRange)
                    {
                        candidates.Add(kvp.Key);
                        if (ColonistVoicesMod.settings.debugMode)
                            Log.Message("[ColonistVoices] Perfect match: " + kvp.Value.name);
                    }
                }
                
                // If no exact age match, use any voice of same gender
                if (candidates.Count == 0)
                {
                    if (ColonistVoicesMod.settings.debugMode)
                        Log.Message("[ColonistVoices] No exact age match, using any " + gender + " voice");
                        
                    foreach (var kvp in voiceDatabase)
                    {
                        if (kvp.Value.gender == gender)
                        {
                            candidates.Add(kvp.Key);
                            if (ColonistVoicesMod.settings.debugMode)
                                Log.Message("[ColonistVoices] Gender match: " + kvp.Value.name);
                        }
                    }
                }
                
                // Fallback to default if still no match
                if (candidates.Count == 0)
                {
                    Log.Warning("[ColonistVoices] No gender match! Using default voice");
                    return ColonistVoicesMod.settings.defaultVoiceId;
                }
                
                // Use colonist ID to deterministically pick a voice
                int hash = GetStableHash(colonist.ThingID);
                int index = Math.Abs(hash % candidates.Count);
                string selectedVoiceId = candidates[index];
                
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Message(string.Format("[ColonistVoices] Selected voice: {0} (index {1} of {2})", 
                        voiceDatabase[selectedVoiceId].name, index, candidates.Count));
                
                // Cache it
                ColonistVoicesMod.settings.colonistVoices[colonist.ThingID] = selectedVoiceId;
                
                return selectedVoiceId;
            }
            catch (Exception e)
            {
                Log.Error("[ColonistVoices] Exception in SelectVoiceForColonist: " + e.ToString());
                return ColonistVoicesMod.settings.defaultVoiceId;
            }
        }
        
        private static AgeRange GetAgeRange(Pawn colonist)
        {
            long age = colonist.ageTracker.AgeBiologicalYears;
            
            if (age < 30) return AgeRange.Young;
            if (age < 50) return AgeRange.Adult;
            return AgeRange.Elderly;
        }
        
        private static int GetStableHash(string input)
        {
            if (string.IsNullOrEmpty(input))
                return 0;
                
            int hash = 17;
            for (int i = 0; i < input.Length; i++)
            {
                hash = hash * 31 + input[i];
            }
            return hash;
        }
        
        public static string GetVoiceName(string voiceId)
        {
            if (voiceDatabase.ContainsKey(voiceId))
                return voiceDatabase[voiceId].name;
            return "Unknown";
        }
        
        public static List<string> GetAllVoiceIds()
        {
            return voiceDatabase.Keys.ToList();
        }
    }
    
    public class VoiceProfile
    {
        public string name;
        public Gender gender;
        public AgeRange ageRange;
        public string[] characteristics;
        
        public VoiceProfile(string name, Gender gender, AgeRange ageRange, string[] characteristics)
        {
            this.name = name;
            this.gender = gender;
            this.ageRange = ageRange;
            this.characteristics = characteristics;
        }
    }
    
    public enum AgeRange
    {
        Young,      // < 30
        Adult,      // 30-50
        Elderly     // 50+
    }
}
