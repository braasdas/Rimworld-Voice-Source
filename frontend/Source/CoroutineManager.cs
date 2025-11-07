using System.Collections;
using UnityEngine;
using Verse;

namespace ColonistVoices
{
    public class CoroutineManager : MonoBehaviour
    {
        private static CoroutineManager instance;
        
        public static CoroutineManager Instance
        {
            get
            {
                if (instance == null)
                {
                    GameObject go = new GameObject("ColonistVoicesCoroutineManager");
                    instance = go.AddComponent<CoroutineManager>();
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
            DontDestroyOnLoad(gameObject);
        }
        
        public new Coroutine StartCoroutine(IEnumerator routine)
        {
            return base.StartCoroutine(routine);
        }
        
        public new void StopCoroutine(Coroutine routine)
        {
            if (routine != null)
                base.StopCoroutine(routine);
        }
    }
}
