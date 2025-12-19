'use client'

import React, { useState, useEffect } from 'react';
import { ChevronRight, RotateCcw, Eye, Check, X, Upload, Download, Volume2, BarChart3, Flame, Zap, LogOut } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const defaultVocab = [
  { category: "Meeting", english: "Just to align on the next steps", german: "Nur zur Abstimmung der nächsten Schritte", example: "Just to align on the next steps, I suggest a follow-up call." },
  { category: "Meeting", english: "From my understanding", german: "Meines Verständnisses nach", example: "From my understanding, this is still open." }
];

type VocabItem = {
  category: string;
  english: string;
  german: string;
  example: string;
};


export default function VocabTrainer() {
const [user, setUser] = useState<any>(null);
const [mode, setMode] = useState('menu');
const [authMode, setAuthMode] = useState('login');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(true);
const [questionType, setQuestionType] = useState('german');
const [currentIndex, setCurrentIndex] = useState(0);
const [shuffledVocab, setShuffledVocab] = useState<any[]>([]);
const [showAnswer, setShowAnswer] = useState(false);
const [score, setScore] = useState({ correct: 0, total: 0 });
const [selectedCategory, setSelectedCategory] = useState('all');
const [vocabData, setVocabData] = useState<any[]>(defaultVocab);
const [showImport, setShowImport] = useState(false);
const [vocabProgress, setVocabProgress] = useState<Record<string, any>>({});
const [dailyStats, setDailyStats] = useState<Record<string, any>>({});

  const supabase = createClientComponentClient();
  const categories = ['all', ...new Set(vocabData.map(v => v.category))];

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      await loadUserData(session.user.id);
    }
    setLoading(false);
  };

const loadUserData = async (userId: string) => {
    const { data: progress } = await supabase
      .from('vocab_progress')
      .select('*')
      .eq('user_id', userId);
    
    if (progress) {
      const progressMap: Record<string, any> = {};
      
      progress.forEach(p => {
        const key = `${p.english}-${p.german}`;
        progressMap[key] = {
          category: p.category,
          level: p.level,
          correctCount: p.correct_count,
          incorrectCount: p.incorrect_count,
          lastReviewed: p.last_reviewed,
          nextReview: p.next_review,
          totalReviews: p.correct_count + p.incorrect_count
        };
      });
      setVocabProgress(progressMap);
    }

    const { data: statsData } = await supabase
      .from('learning_stats')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30);
    
    if (statsData) {
      const statsMap: Record<string, any> = {};
      statsData.forEach(s => {
        statsMap[s.date] = {
          date: s.date,
          questionsAnswered: s.questions_answered,
          correctAnswers: s.correct_answers
        };
      });
      setDailyStats(statsMap);
    }
const { data: vocabRows, error: vocabError } = await supabase
  .from('vocab_items')
  .select('category, english, german, example')
  .eq('user_id', userId)
  .order('id', { ascending: true });

if (vocabError) {
  console.error('Failed to load vocab_items:', vocabError.message);
} else if (vocabRows) {
  setVocabData(vocabRows);
}

    
  };

const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert('Login failed: ' + error.message);
      } else {
        await checkUser();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert('Registration failed: ' + error.message);
      } else {
        alert('Registration successful! Please check your email to confirm.');
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setVocabProgress({});
    setDailyStats({});
  };

const getVocabKey = (vocab: any) => `${vocab.english}-${vocab.german}`;

const updateVocabProgress = async (vocab: any, isCorrect: boolean) => {
    if (!user) return;

    const key = getVocabKey(vocab);
    const existing = vocabProgress[key];
    
    const newLevel = existing 
      ? Math.max(0, Math.min(5, existing.level + (isCorrect ? 1 : -1)))
      : (isCorrect ? 1 : 0);
    
    const nextReview = new Date();
    const daysUntilNext = [0, 1, 3, 7, 14, 30][newLevel];
    nextReview.setDate(nextReview.getDate() + daysUntilNext);

    const progressData = {
      user_id: user.id,
      english: vocab.english,
      german: vocab.german,
      category: vocab.category,
      level: newLevel,
      correct_count: (existing?.correctCount || 0) + (isCorrect ? 1 : 0),
      incorrect_count: (existing?.incorrectCount || 0) + (isCorrect ? 0 : 1),
      last_reviewed: new Date().toISOString(),
      next_review: nextReview.toISOString()
    };

    const { data, error } = await supabase
      .from('vocab_progress')
      .upsert(progressData, { onConflict: 'user_id,english,german' })
      .select()
      .single();

    if (!error && data) {
      setVocabProgress(prev => ({ 
        ...prev, 
        [key]: {
          category: data.category,
          level: data.level,
          correctCount: data.correct_count,
          incorrectCount: data.incorrect_count,
          lastReviewed: data.last_reviewed,
          nextReview: data.next_review,
          totalReviews: data.correct_count + data.incorrect_count
        }
      }));
    }

    await updateDailyStats(isCorrect);
  };

  const updateDailyStats = async (isCorrect: boolean) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    const { data: existing } = await supabase
      .from('learning_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    const statsData = {
      user_id: user.id,
      date: today,
      questions_answered: (existing?.questions_answered || 0) + 1,
      correct_answers: (existing?.correct_answers || 0) + (isCorrect ? 1 : 0),
      streak_days: existing?.streak_days || 1
    };

    await supabase
      .from('learning_stats')
      .upsert(statsData, { onConflict: 'user_id,date' });
    
    setDailyStats(prev => ({
      ...prev,
      [today]: {
        date: today,
        questionsAnswered: statsData.questions_answered,
        correctAnswers: statsData.correct_answers
      }
    }));
  };

  const calculateStreak = () => {
    const dates = Object.keys(dailyStats).sort().reverse();
    if (dates.length === 0) return 0;
    
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let currentDate = new Date(today);
    
    for (let i = 0; i < dates.length; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (dates.includes(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  };

  useEffect(() => {
    shuffleVocab();
  }, [selectedCategory, vocabData]);

  const shuffleVocab = () => {
    let filtered = selectedCategory === 'all' 
      ? vocabData 
      : vocabData.filter(v => v.category === selectedCategory);
    
    if (Object.keys(vocabProgress).length > 0) {
      filtered = filtered.map(v => {
        const key = getVocabKey(v);
        const progress = vocabProgress[key];
        const weight = progress ? (6 - progress.level) : 3;
        return { ...v, weight };
      });
      
     const weighted: any[] = [];
      filtered.forEach(v => {
        for (let i = 0; i < v.weight; i++) {
          weighted.push(v);
        }
      });
      filtered = weighted;
    }
    
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    setShuffledVocab(shuffled);
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  const speakText = (text: string, language: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (language === 'english') {
          utterance.lang = 'en-GB';
          utterance.rate = 0.85;
        } else {
          utterance.lang = 'de-DE';
          utterance.rate = 0.85;
        }
        
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => {
          if (language === 'english') {
            return voice.lang.startsWith('en') && !voice.name.includes('Compact');
          } else {
            return voice.lang.startsWith('de') && !voice.name.includes('Compact');
          }
        });
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        window.speechSynthesis.speak(utterance);
      };
      
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          speak();
        };
      } else {
        speak();
      }
    }
  };
const replaceVocabInSupabase = async (
  items: { category: string; english: string; german: string; example?: string }[]
) => {
  if (!user) {
    alert("Bitte erst einloggen, bevor du importierst.");
    return;
  }

  // 1) Alte Vokabeln löschen (ersetzen!)
  const { error: delErr } = await supabase
    .from("vocab_items")
    .delete()
    .eq("user_id", user.id);

  if (delErr) throw delErr;

  // 2) Neue Vokabeln einfügen
  const rows = items.map(v => ({
    user_id: user.id,
    category: v.category,
    english: v.english,
    german: v.german,
    example: v.example ?? ""
  }));

  const { error: insErr } = await supabase
    .from("vocab_items")
    .insert(rows);

  if (insErr) throw insErr;
};
  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

 const handleAnswer = async (isCorrect: boolean) => {
    setScore({ ...score, correct: score.correct + (isCorrect ? 1 : 0), total: score.total + 1 });
    
    const currentVocab = shuffledVocab[currentIndex];
    await updateVocabProgress(currentVocab, isCorrect);
    
    if (currentIndex < shuffledVocab.length - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      }, 500);
    } else {
      setTimeout(() => {
        setMode('result');
      }, 500);
    }
  };

  const resetQuiz = () => {
    setScore({ correct: 0, total: 0 });
    setMode('menu');
    shuffleVocab();
  };

 const startQuiz = (type: string) => {
    setQuestionType(type);
    setMode('quiz');
    setScore({ correct: 0, total: 0 });
    shuffleVocab();
  };
const handleImportVocabFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const ext = file.name.split(".").pop()?.toLowerCase();

    let items: VocabItem[] = [];

    // ✅ JSON
    if (ext === "json") {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        alert("Falsches Format. JSON muss eine Liste sein: [{category, english, german, example}, ...]");
        return;
      }

      items = parsed.map((v: any) => ({
        category: String(v.category ?? "General").trim(),
        english: String(v.english ?? "").trim(),
        german: String(v.german ?? "").trim(),
        example: String(v.example ?? "").trim(),
      }));
    }

    // ✅ Excel (xlsx/xls)
    else if (ext === "xlsx" || ext === "xls") {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const sheetName = wb.SheetNames[0]; // nimmt erstes Sheet
      const sheet = wb.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      const pick = (row: Record<string, any>, keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return String(row[k]);
        }
        return "";
      };

      items = rows.map(r => ({
        category: pick(r, ["Category", "category", "Kategorie"]) || "General",
        english: pick(r, ["English term", "English", "english"]),
        german: pick(r, ["German explanation", "German", "german", "Deutsch"]),
        example: pick(r, ["Example sentence", "Example", "example"]) || "",
      }));
    } else {
      alert("Bitte eine .json oder .xlsx Datei auswählen.");
      return;
    }

    // ✅ validieren
    const valid = items
      .map(v => ({
        category: v.category.trim() || "General",
        english: v.english.trim(),
        german: v.german.trim(),
        example: (v.example ?? "").trim(),
      }))
      .filter(v => v.english && v.german);

    if (valid.length === 0) {
      alert("Keine gültigen Einträge gefunden (english + german müssen gefüllt sein).");
      return;
    }

    // UI sofort updaten
    setVocabData(valid);
    setSelectedCategory("all");
    setShowImport(false);

    // ✅ Supabase: ersetzen
    await replaceVocabInSupabase(valid);

    // optional: Progress/Stats reset (weil Wörter ersetzt wurden)
    await supabase.from("vocab_progress").delete().eq("user_id", user.id);
    await supabase.from("learning_stats").delete().eq("user_id", user.id);
    setVocabProgress({});
    setDailyStats({});

    alert(`Import ok: ${valid.length} Vokabeln`);
  } catch (err: any) {
    alert("Import fehlgeschlagen: " + err.message);
  } finally {
    e.target.value = "";
  }
};


  const exportProgress = () => {
    const data = {
      vocabProgress,
      dailyStats,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocly-progress-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };




  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-900 text-2xl font-medium">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-4">
              <Zap className="text-white" size={32} />
            </div>
            <h1 className="text-5xl font-semibold text-gray-900 mb-2">
              Vocly
            </h1>
            <p className="text-gray-600">Master your vocabulary</p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-8 border border-gray-200">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  authMode === 'login'
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  authMode === 'register'
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2 text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2 text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black hover:bg-gray-800 text-white font-medium py-4 rounded-xl transition-all disabled:opacity-50"
              >
                {authMode === 'login' ? 'Login' : 'Register'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'stats') {
    const masteredCount = Object.values(vocabProgress).filter((p: any) => p.level >= 4).length;
    const learningCount = Object.values(vocabProgress).filter((p: any) => p.level > 0 && p.level < 4).length;
    const newCount = vocabData.length - Object.keys(vocabProgress).length;
    const streak = calculateStreak();
    const today = new Date().toISOString().split('T')[0];
    const todayStats = dailyStats[today] || { questionsAnswered: 0, correctAnswers: 0 };

    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-semibold text-gray-900">Progress</h1>
            <button
              onClick={() => setMode('menu')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl transition-all font-medium"
            >
              Back
            </button>
          </div>

          {streak > 0 && (
            <div className="bg-orange-50 rounded-2xl p-6 border border-orange-200 mb-6 flex items-center gap-4">
              <Flame className="text-orange-500" size={40} />
              <div>
                <div className="text-3xl font-semibold text-gray-900">{streak} days</div>
                <div className="text-gray-600">Streak</div>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="text-green-600 text-4xl font-semibold mb-2">{masteredCount}</div>
              <div className="text-gray-600">Mastered</div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="text-blue-600 text-4xl font-semibold mb-2">{learningCount}</div>
              <div className="text-gray-600">Learning</div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="text-gray-400 text-4xl font-semibold mb-2">{newCount}</div>
              <div className="text-gray-600">New</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Today</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-semibold text-gray-900">{todayStats.questionsAnswered}</div>
                <div className="text-gray-600">Questions</div>
              </div>
              <div>
                <div className="text-3xl font-semibold text-green-600">
                  {todayStats.questionsAnswered > 0 ? Math.round((todayStats.correctAnswers / todayStats.questionsAnswered) * 100) : 0}%
                </div>
                <div className="text-gray-600">Correct</div>
              </div>
            </div>
          </div>

          <button
            onClick={exportProgress}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-4 px-6 rounded-2xl transition-all flex items-center justify-center"
          >
            <Download className="mr-2" size={20} />
            Export Progress
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'menu') {
    const streak = calculateStreak();
    
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="text-center flex-1">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-4">
                <Zap className="text-white" size={32} />
              </div>
              <h1 className="text-5xl font-semibold text-gray-900 mb-2">
                Vocly
              </h1>
              <p className="text-gray-600">Master your vocabulary</p>
              {streak > 0 && (
                <div className="mt-4 inline-flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-full border border-orange-200">
                  <Flame className="text-orange-500" size={18} />
                  <span className="text-gray-900 font-medium">{streak} day streak</span>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 p-3 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setMode('stats')}
              className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-gray-300 transition-all text-center"
            >
              <BarChart3 className="text-gray-900 mb-2 mx-auto" size={28} />
              <div className="text-gray-900 font-medium">Progress</div>
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-gray-300 transition-all text-center"
            >
              <Upload className="text-gray-900 mb-2 mx-auto" size={28} />
              <div className="text-gray-900 font-medium">Import</div>
            </button>
          </div>
          
          <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200">
            <p className="text-sm text-gray-600"><span className="text-gray-900 font-semibold">{vocabData.length}</span> vocabulary items</p>
          </div>

          <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200">
            <label className="block text-sm font-medium text-gray-900 mb-3">Category</label>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => startQuiz('german')}
              className="group w-full bg-black hover:bg-gray-800 text-white font-medium py-5 px-6 rounded-2xl transition-all flex items-center justify-between"
            >
              <span>🇩🇪 → 🇬🇧 German to English</span>
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => startQuiz('english')}
              className="group w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-5 px-6 rounded-2xl transition-all flex items-center justify-between"
            >
              <span>🇬🇧 → 🇩🇪 English to German</span>
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
        {showImport && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-3xl p-6 w-full max-w-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900">Import vocabulary (JSON)</h3>
        <button
          onClick={() => setShowImport(false)}
          className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium"
        >
          Close
        </button>
      </div>

      <input
        type="file"
      accept=".json,application/json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel"
        onChange={handleImportVocabFile}
        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl"
      />

      <p className="text-sm text-gray-600 mt-3">
        Tipp: Importiere die Datei <b>vocly-vocab-momo.json</b>.
      </p>
    </div>
  </div>
)}
      </div>
    );
  }

  if (mode === 'result') {
    const percentage = Math.round((score.correct / score.total) * 100);
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-sm p-10 max-w-md w-full text-center border border-gray-200">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-6">
            <Check className="text-white" size={32} />
          </div>
          <h2 className="text-4xl font-semibold text-gray-900 mb-6">Done!</h2>
          <div className="text-7xl font-semibold text-gray-900 mb-6">
            {percentage}%
          </div>
          <p className="text-xl text-gray-600 mb-8">
            <span className="text-green-600 font-semibold">{score.correct}</span> of <span className="text-gray-900 font-semibold">{score.total}</span> correct
          </p>
          <button
            onClick={resetQuiz}
            className="bg-black hover:bg-gray-800 text-white font-medium py-4 px-8 rounded-2xl transition-all flex items-center justify-center mx-auto"
          >
            <RotateCcw className="mr-2" size={20} />
            Again
          </button>
        </div>
      </div>
    );
  }

  const currentVocab = shuffledVocab[currentIndex];
  if (!currentVocab) return null;

  const question = questionType === 'german' ? currentVocab.german : currentVocab.english;
  const answer = questionType === 'german' ? currentVocab.english : currentVocab.german;
  const vocabKey = getVocabKey(currentVocab);
  const progress = vocabProgress[vocabKey];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="bg-white px-4 py-2 rounded-full text-gray-600 border border-gray-200 text-sm">
            {currentIndex + 1} / {shuffledVocab.length}
          </div>
          <div className="flex gap-3">
            {progress && (
              <div className="bg-white px-4 py-2 rounded-full text-gray-900 border border-gray-200 text-sm font-medium">
                Level {progress.level}
              </div>
            )}
            <div className="bg-black px-5 py-2 rounded-full text-white font-semibold text-sm">
              {score.correct}/{score.total}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-8 sm:p-10 mb-6 border border-gray-200">
          <div className="inline-block bg-gray-100 px-4 py-1 rounded-full text-gray-700 text-sm font-medium mb-6">
            {currentVocab.category}
          </div>
          
          <div className="flex items-start gap-4 mb-10">
            <div className="text-3xl sm:text-4xl font-semibold text-gray-900 flex-1 leading-tight">{question}</div>
            <button
              onClick={() => speakText(question, questionType === 'german' ? 'german' : 'english')}
              className="bg-gray-900 hover:bg-gray-800 text-white p-4 rounded-2xl transition-all"
            >
              <Volume2 size={24} />
            </button>
          </div>
          
          {!showAnswer ? (
            <button
              onClick={handleShowAnswer}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium py-5 px-6 rounded-2xl transition-all flex items-center justify-center"
            >
              <Eye className="mr-3" size={20} />
              Show answer
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <div className="text-sm text-gray-600 mb-2 font-medium">Answer</div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-2xl sm:text-3xl font-semibold text-gray-900 flex-1">{answer}</div>
                  <button
                    onClick={() => speakText(answer, questionType === 'german' ? 'english' : 'german')}
                    className="bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-xl transition-all"
                  >
                    <Volume2 size={20} />
                  </button>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <div className="text-sm text-gray-600 mb-2 font-medium">Example</div>
                <div className="flex items-start gap-4">
                  <div className="text-gray-700 flex-1">{currentVocab.example}</div>
                  <button
                    onClick={() =>speakText(currentVocab.example, 'english')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-900 p-3 rounded-xl transition-all"
                  >
                    <Volume2 size={20} />
                  </button>
                </div>
              </div>
              
              <div className="text-center text-gray-900 font-medium text-lg pt-4">Did you know it?</div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleAnswer(true)}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-5 px-6 rounded-2xl transition-all flex items-center justify-center"
                >
                  <Check className="mr-2" size={20} />
                  Yes
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-5 px-6 rounded-2xl transition-all flex items-center justify-center"
                >
                  <X className="mr-2" size={20} />
                  No
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={resetQuiz}
          className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          ← Back to menu
        </button>
      </div>
    </div>
  );
}
