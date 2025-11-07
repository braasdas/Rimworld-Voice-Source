using UnityEngine;
using RimWorld;
using Verse;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ColonistVoices
{
    public static class ColonistContextBuilder
    {
        public static string BuildContext(Pawn colonist)
        {
            var settings = ColonistVoicesMod.settings;
            StringBuilder context = new StringBuilder();
            
            // Basic info
            context.AppendLine(string.Format("You are {0}, a colonist in a RimWorld colony.", colonist.Name.ToStringShort));
            context.AppendLine(string.Format("Age: {0}", colonist.ageTracker.AgeBiologicalYears));
            context.AppendLine(string.Format("Gender: {0}", colonist.gender));
            
            // Current activity
            if (settings.includeCurrentActivity && colonist.CurJob != null)
            {
                context.AppendLine(string.Format("Currently: {0}", GetJobDescription(colonist)));
            }
            
            // Thoughts and mood
            if (settings.includeThoughts && colonist.needs != null && colonist.needs.mood != null && colonist.needs.mood.thoughts != null)
            {
                var thoughts = GetSignificantThoughts(colonist);
                if (thoughts.Any())
                {
                    context.AppendLine("\nCurrent thoughts:");
                    foreach (var thought in thoughts)
                    {
                        context.AppendLine(string.Format("- {0}", thought));
                    }
                }
            }
            
            // Health conditions
            if (settings.includeHediffs && colonist.health != null && colonist.health.hediffSet != null)
            {
                var hediffs = GetSignificantHediffs(colonist);
                if (hediffs.Any())
                {
                    context.AppendLine("\nHealth conditions:");
                    foreach (var hediff in hediffs)
                    {
                        context.AppendLine(string.Format("- {0}", hediff));
                    }
                }
            }
            
            // Recent memories
            if (settings.includeRecentMemories && colonist.needs != null && colonist.needs.mood != null && colonist.needs.mood.thoughts != null && colonist.needs.mood.thoughts.memories != null)
            {
                var memories = GetRecentMemories(colonist, settings.maxRecentMemories);
                if (memories.Any())
                {
                    context.AppendLine("\nRecent events:");
                    foreach (var memory in memories)
                    {
                        context.AppendLine(string.Format("- {0}", memory));
                    }
                }
            }
            
            // Relationships
            if (settings.includeRelationships && colonist.relations != null)
            {
                var relationships = GetSignificantRelationships(colonist);
                if (relationships.Any())
                {
                    context.AppendLine("\nImportant relationships:");
                    foreach (var rel in relationships)
                    {
                        context.AppendLine(string.Format("- {0}", rel));
                    }
                }
            }
            
            return context.ToString();
        }
        
        private static string GetJobDescription(Pawn colonist)
        {
            if (colonist.CurJob == null) return "Idle";
            
            string jobDef = colonist.CurJob.def != null && colonist.CurJob.def.reportString != null ? colonist.CurJob.def.reportString : "doing something";
            jobDef = jobDef.Replace("TargetA", colonist.CurJob.targetA.Thing != null ? colonist.CurJob.targetA.Thing.LabelShort : "something");
            jobDef = jobDef.Replace("TargetB", colonist.CurJob.targetB.Thing != null ? colonist.CurJob.targetB.Thing.LabelShort : "something");
            
            return jobDef;
        }
        
        private static List<string> GetSignificantThoughts(Pawn colonist)
        {
            var thoughts = new List<string>();
            
            try
            {
                var thoughtHandler = colonist.needs.mood.thoughts;
                
                // Get all memory thoughts
                if (thoughtHandler.memories != null && thoughtHandler.memories.Memories != null)
                {
                    foreach (var memory in thoughtHandler.memories.Memories)
                    {
                        if (memory != null)
                        {
                            float moodOffset = memory.MoodOffset();
                            if (Mathf.Abs(moodOffset) > 2f) // Only significant thoughts
                            {
                                string label = memory.LabelCap;
                                thoughts.Add(string.Format("{0} ({1}{2:F0} mood)", label, (moodOffset > 0 ? "+" : ""), moodOffset));
                            }
                        }
                    }
                }
                
                // Also get situational thoughts
                if (thoughtHandler.situational != null)
                {
                    // Get distinct situational thoughts manually since GetDistinctSituationalThoughts may not exist
                    List<Thought> situationalThoughts = new List<Thought>();
                    thoughtHandler.situational.AppendMoodThoughts(situationalThoughts);
                    
                    foreach (var thought in situationalThoughts)
                    {
                        if (thought != null)
                        {
                            float moodOffset = thought.MoodOffset();
                            if (Mathf.Abs(moodOffset) > 2f)
                            {
                                string label = thought.LabelCap;
                                thoughts.Add(string.Format("{0} ({1}{2:F0} mood)", label, (moodOffset > 0 ? "+" : ""), moodOffset));
                            }
                        }
                    }
                }
            }
            catch (System.Exception e)
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Warning(string.Format("[ColonistVoices] Error getting thoughts: {0}", e.Message));
            }
            
            return thoughts.Take(5).ToList();
        }
        
        private static List<string> GetSignificantHediffs(Pawn colonist)
        {
            var hediffs = new List<string>();
            
            try
            {
                foreach (var hediff in colonist.health.hediffSet.hediffs)
                {
                    // Skip minor or non-impactful hediffs
                    if (hediff.Visible || hediff.def.makesSickThought)
                    {
                        string severity = "";
                        if (hediff.def.lethalSeverity > 0)
                        {
                            float percent = (hediff.Severity / hediff.def.lethalSeverity) * 100f;
                            severity = string.Format(" ({0:F0}% severity)", percent);
                        }
                        hediffs.Add(string.Format("{0}{1}", hediff.LabelCap, severity));
                    }
                }
            }
            catch (System.Exception e)
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Warning(string.Format("[ColonistVoices] Error getting hediffs: {0}", e.Message));
            }
            
            return hediffs.Take(5).ToList();
        }
        
        private static List<string> GetRecentMemories(Pawn colonist, int maxCount)
        {
            var memories = new List<string>();
            
            try
            {
                var memoryThoughts = colonist.needs.mood.thoughts.memories.Memories
                    .OrderByDescending(m => m.age)
                    .Take(maxCount);
                
                foreach (var memory in memoryThoughts)
                {
                    if (memory.age < 60000) // Recent (less than 1 day old)
                    {
                        memories.Add(string.Format("{0} ({1})", memory.LabelCap, GetTimeAgo(memory.age)));
                    }
                }
            }
            catch (System.Exception e)
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Warning(string.Format("[ColonistVoices] Error getting memories: {0}", e.Message));
            }
            
            return memories;
        }
        
        private static List<string> GetSignificantRelationships(Pawn colonist)
        {
            var relationships = new List<string>();
            
            try
            {
                foreach (var rel in colonist.relations.DirectRelations)
                {
                    string relType = rel.def.GetGenderSpecificLabel(rel.otherPawn);
                    relationships.Add(string.Format("{0} - {1}", rel.otherPawn.Name.ToStringShort, relType));
                }
            }
            catch (System.Exception e)
            {
                if (ColonistVoicesMod.settings.debugMode)
                    Log.Warning(string.Format("[ColonistVoices] Error getting relationships: {0}", e.Message));
            }
            
            return relationships.Take(5).ToList();
        }
        
        private static string GetTimeAgo(int ticks)
        {
            int hours = ticks / 2500;
            if (hours < 1) return "moments ago";
            if (hours == 1) return "1 hour ago";
            if (hours < 24) return string.Format("{0} hours ago", hours);
            int days = hours / 24;
            if (days == 1) return "1 day ago";
            return string.Format("{0} days ago", days);
        }
    }
}
