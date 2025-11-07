using System;
using System.Collections.Generic;
using Verse;

namespace ColonistVoices
{
    // Wrapper class to make List<string> saveable
    public class SpeechHistoryEntry : IExposable
    {
        public List<string> speeches = new List<string>();
        
        public SpeechHistoryEntry()
        {
        }
        
        public SpeechHistoryEntry(List<string> speeches)
        {
            this.speeches = speeches ?? new List<string>();
        }
        
        public void ExposeData()
        {
            Scribe_Collections.Look(ref speeches, "speeches", LookMode.Value);
            
            if (Scribe.mode == LoadSaveMode.LoadingVars)
            {
                if (speeches == null)
                    speeches = new List<string>();
            }
        }
    }
}
