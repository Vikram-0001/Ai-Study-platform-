"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, MessageSquare, UploadCloud, CheckCircle, AlertCircle, 
  Trash2, Bookmark, History, BarChart2, Plus, Send, Users, Check, 
  HelpCircle, FileText, Calendar, TrendingUp, LogOut, Lock, Unlock, 
  Globe, RefreshCw, ChevronRight, Eye, ShieldAlert, Sparkles, BookMarked
} from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function Home() {
  // --- AUTHENTICATION STATE ---
  const [user, setUser] = useState<{ token: string; username: string; role: string } | null>(null);
  const [authMode, setAuthMode] = useState<"landing" | "login" | "signup">("landing");
  const [usernameInput, setUsernameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [roleInput, setRoleInput] = useState("student");
  const [errorMsg, setErrorMsg] = useState("");

  // --- DASHBOARD STATE ---
  const [activeView, setActiveView] = useState<string>("chat");
  const [documents, setDocuments] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<string>("default_session");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [queryText, setQueryText] = useState("");

  // --- FILTER METADATA STATE ---
  const [filterDept, setFilterDept] = useState("");
  const [filterSem, setFilterSem] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterTopic, setFilterTopic] = useState("");

  // --- UPLOAD STATE ---
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVisibility, setUploadVisibility] = useState("private");
  const [uploadDept, setUploadDept] = useState("");
  const [uploadSem, setUploadSem] = useState("");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadUnit, setUploadUnit] = useState("");
  const [uploadTopic, setUploadTopic] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");

  // --- STUDY GENERATORS STATE ---
  const [generatorTopic, setGeneratorTopic] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [studyToolTab, setStudyToolTab] = useState<"quiz" | "viva" | "revision" | "planner" | "pyq">("quiz");
  const [generatedOutput, setGeneratedOutput] = useState<any>(null);
  const [quizResponses, setQuizResponses] = useState<Record<number, string>>({});
  const [showQuizExplanations, setShowQuizExplanations] = useState<Record<number, boolean>>({});
  const [vivaFlipped, setVivaFlipped] = useState<Record<number, boolean>>({});

  // --- SAVED ACADEMIC ITEMS ---
  const [savedQuizzes, setSavedQuizzes] = useState<any[]>([]);
  const [savedFlashcards, setSavedFlashcards] = useState<any[]>([]);
  const [savedPlans, setSavedPlans] = useState<any[]>([]);

  // --- ADMIN PORTAL STATE ---
  const [adminQueue, setAdminQueue] = useState<any[]>([]);
  const [adminAnalytics, setAdminAnalytics] = useState<any>(null);
  const [adminStudents, setAdminStudents] = useState<any[]>([]);

  // --- GLOBAL LOADING ---
  const [isProcessing, setIsProcessing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- EFFECT: LOAD AUTH STATE ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");
    if (token && username && role) {
      setUser({ token, username, role });
      // If user is admin, set view to queue dashboard, otherwise chat
      setActiveView(role === "admin" ? "admin_queue" : "chat");
    }
  }, []);

  // --- EFFECT: UPDATE CORRESPONDING DATA ON VIEW SWITCH ---
  useEffect(() => {
    if (!user) return;
    if (activeView === "documents" || activeView === "admin_docs") {
      fetchDocuments();
    } else if (activeView === "bookmarks") {
      fetchBookmarks();
    } else if (activeView === "history") {
      fetchSessions();
    } else if (activeView === "admin_queue") {
      fetchAdminQueue();
    } else if (activeView === "admin_analytics") {
      fetchAdminAnalytics();
    } else if (activeView === "admin_students") {
      fetchAdminStudents();
    } else if (activeView === "chat") {
      fetchSessions();
      loadActiveChatHistory();
    }
  }, [activeView, user, activeSession]);

  // Scroll Chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // --- ACTIONS: AUTHENTICATION ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsProcessing(true);
    try {
      if (supabase) {
        if (authMode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email: emailInput,
            password: passwordInput,
            options: {
              data: {
                username: usernameInput,
                role: roleInput
              }
            }
          });
          if (error) throw error;
          
          const sessionToken = data.session?.access_token;
          if (sessionToken) {
            const syncRes = await api.auth.sync(sessionToken);
            localStorage.setItem("token", sessionToken);
            localStorage.setItem("username", syncRes.username);
            localStorage.setItem("role", syncRes.role);
            setUser({ token: sessionToken, username: syncRes.username, role: syncRes.role });
            setActiveView(syncRes.role === "admin" ? "admin_queue" : "chat");
          } else {
            alert("Sign up successful! Please check your email to confirm registration before logging in.");
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput || usernameInput,
            password: passwordInput
          });
          if (error) throw error;
          
          const sessionToken = data.session?.access_token;
          if (sessionToken) {
            const syncRes = await api.auth.sync(sessionToken);
            localStorage.setItem("token", sessionToken);
            localStorage.setItem("username", syncRes.username);
            localStorage.setItem("role", syncRes.role);
            setUser({ token: sessionToken, username: syncRes.username, role: syncRes.role });
            setActiveView(syncRes.role === "admin" ? "admin_queue" : "chat");
          }
        }
      } else {
        if (authMode === "signup") {
          const data = await api.auth.signup({
            username: usernameInput,
            email: emailInput,
            password: passwordInput,
            role: roleInput
          });
          localStorage.setItem("token", data.access_token);
          localStorage.setItem("username", data.username);
          localStorage.setItem("role", data.role);
          setUser({ token: data.access_token, username: data.username, role: data.role });
          setActiveView(data.role === "admin" ? "admin_queue" : "chat");
        } else {
          const data = await api.auth.login({
            username_or_email: emailInput || usernameInput,
            password: passwordInput
          });
          localStorage.setItem("token", data.access_token);
          localStorage.setItem("username", data.username);
          localStorage.setItem("role", data.role);
          setUser({ token: data.access_token, username: data.username, role: data.role });
          setActiveView(data.role === "admin" ? "admin_queue" : "chat");
        }
      }
      // Reset inputs
      setUsernameInput("");
      setEmailInput("");
      setPasswordInput("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed authentication request");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error(err);
      }
    }
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setUser(null);
    setAuthMode("landing");
    setChatMessages([]);
  };


  // --- ACTIONS: DATA FETCHING ---
  const fetchDocuments = async () => {
    try {
      const data = await api.documents.list();
      setDocuments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const data = await api.chat.listBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    try {
      const data = await api.chat.getSessions();
      setSessions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadActiveChatHistory = async () => {
    if (!activeSession) return;
    try {
      const data = await api.chat.getHistory(activeSession);
      // Map API history items back to chat display format
      const formatted = data.map((msg: any) => ({
        role: msg.role,
        text: msg.content,
        decision: msg.decision,
        citations: msg.citations || []
      }));
      setChatMessages(formatted.length > 0 ? formatted : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminQueue = async () => {
    try {
      const data = await api.admin.getQueue();
      setAdminQueue(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminAnalytics = async () => {
    try {
      const data = await api.admin.getAnalytics();
      setAdminAnalytics(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminStudents = async () => {
    try {
      const data = await api.admin.getStudents();
      setAdminStudents(data);
    } catch (err) {
      console.error(err);
    }
  };

  // --- ACTIONS: UPLOAD ---
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadProgress("Uploading and parsing document chunks...");
    setIsProcessing(true);

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("visibility", user?.role === "admin" ? "global" : uploadVisibility);
    if (uploadDept) formData.append("department", uploadDept);
    if (uploadSem) formData.append("semester", uploadSem);
    if (uploadSubject) formData.append("subject", uploadSubject);
    if (uploadUnit) formData.append("unit", uploadUnit);
    if (uploadTopic) formData.append("topic", uploadTopic);

    try {
      await api.documents.upload(formData);
      setUploadProgress("Document uploaded and indexed successfully!");
      setUploadFile(null);
      // Reset details
      setUploadDept("");
      setUploadSem("");
      setUploadSubject("");
      setUploadUnit("");
      setUploadTopic("");
      fetchDocuments();
    } catch (err: any) {
      setUploadProgress(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.documents.delete(id);
      fetchDocuments();
    } catch (err) {
      alert("Failed to delete document");
    }
  };

  const handleDeleteStudent = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this student account? This will permanently delete all of their uploaded files and vector records.")) return;
    try {
      await api.admin.deleteStudent(userId);
      fetchAdminStudents();
    } catch (err: any) {
      alert(`Failed to delete student: ${err.message}`);
    }
  };

  const handleOpenDocument = (docId: number) => {
    const token = localStorage.getItem("token") || "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const url = `${baseUrl}/documents/${docId}/download?token=${encodeURIComponent(token)}`;
    window.open(url, "_blank");
  };

  // --- ACTIONS: CHAT QUERY ---
  const handleSendQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    const userMessage = {
      role: "user",
      text: queryText,
      decision: "input",
      citations: []
    };

    setChatMessages((prev) => [...prev, userMessage]);
    const originalQuery = queryText;
    setQueryText("");
    setIsProcessing(true);

    try {
      const searchFilters: any = {};
      if (filterDept) searchFilters.department = filterDept;
      if (filterSem) searchFilters.semester = parseInt(filterSem);
      if (filterSubject) searchFilters.subject = filterSubject;
      if (filterUnit) searchFilters.unit = filterUnit;
      if (filterTopic) searchFilters.topic = filterTopic;

      const response = await api.chat.query({
        query: originalQuery,
        session_id: activeSession,
        ...searchFilters
      });

      const assistantMessage = {
        role: "assistant",
        text: response.answer,
        decision: response.decision,
        citations: response.citations || [],
        grounding_score: response.grounding_score
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Error processing query: ${err.message}`,
          decision: "error",
          citations: []
        }
      ]);
    } finally {
      setIsProcessing(false);
      fetchSessions();
    }
  };

  const createNewChatSession = () => {
    const newSessionId = `session_${Date.now()}`;
    setActiveSession(newSessionId);
    setChatMessages([]);
  };

  const handleBookmarkAnswer = async (msg: any) => {
    try {
      await api.chat.saveBookmark({
        query: "Academic Query Query Session",
        answer: msg.text,
        citations: msg.citations
      });
      alert("Answer bookmarked successfully!");
    } catch (err: any) {
      alert(`Error bookmarking: ${err.message}`);
    }
  };

  const handleDeleteBookmark = async (id: number) => {
    try {
      await api.chat.deleteBookmark(id);
      fetchBookmarks();
    } catch (err) {
      alert("Failed to delete bookmark");
    }
  };

  // --- ACTIONS: ADMIN QUEUE ---
  const handleApproveReject = async (docId: number, action: "approve" | "reject") => {
    try {
      await api.admin.approveDocument(docId, action);
      alert(`Document successfully ${action === "approve" ? "Approved" : "Rejected"}`);
      fetchAdminQueue();
    } catch (err: any) {
      alert(`Queue Error: ${err.message}`);
    }
  };

  // --- ACTIONS: STUDY TOOL GENERATION ---
  const handleGenerateStudyTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatorTopic.trim()) return;
    setIsProcessing(true);
    setGeneratedOutput(null);
    setQuizResponses({});
    setShowQuizExplanations({});
    setVivaFlipped({});

    const reqPayload = {
      topic: generatorTopic,
      document_id: selectedDocId ? parseInt(selectedDocId) : undefined
    };

    try {
      if (studyToolTab === "quiz") {
        const data = await api.study.generateQuiz(reqPayload);
        setGeneratedOutput(data);
      } else if (studyToolTab === "viva") {
        const data = await api.study.generateViva(reqPayload);
        setGeneratedOutput(data);
      } else if (studyToolTab === "revision") {
        const data = await api.study.generateRevision(reqPayload);
        setGeneratedOutput(data);
      } else if (studyToolTab === "planner") {
        const data = await api.study.generatePlanner(reqPayload);
        setGeneratedOutput(data);
      } else if (studyToolTab === "pyq") {
        const data = await api.study.analyzePYQs(reqPayload);
        setGeneratedOutput(data);
      }
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveGeneratedAsset = async () => {
    if (!generatedOutput) return;
    try {
      if (studyToolTab === "quiz") {
        await api.study.saveQuiz(generatedOutput);
      } else if (studyToolTab === "revision") {
        await api.study.saveFlashcardDeck({
          deck_name: generatorTopic,
          cards: generatedOutput.notes
        });
      } else if (studyToolTab === "planner") {
        await api.study.saveStudyPlan(generatedOutput);
      }
      alert("Academic asset saved to dashboard successfully!");
    } catch (err: any) {
      alert(`Failed saving item: ${err.message}`);
    }
  };

  // Helper score quiz answers
  const checkAnswerQuiz = (questionIdx: number, selected: string) => {
    setQuizResponses((prev) => ({ ...prev, [questionIdx]: selected }));
    setShowQuizExplanations((prev) => ({ ...prev, [questionIdx]: true }));
  };

  const toggleVivaReveal = (idx: number) => {
    setVivaFlipped((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };


  // --- VIEW RENDERING ENGINE ---

  // 1. Landing View
  if (authMode === "landing" && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
        {/* Glow Sphere */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-600 rounded-full blur-[140px] opacity-35 pointer-events-none animate-glow"></div>

        <div className="relative z-10 max-w-4xl space-y-8 glass-panel-glow p-10 md:p-16 rounded-3xl">
          {/* Logo badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>RAG-First Learning Engine</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
            AI Academic <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400">
              Study Assistant
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-zinc-400 text-base md:text-lg leading-relaxed">
            Upload syllabi, notes, textbooks, and presentations. Our intelligent Decision Engine prioritizes vector datastores to answer factual queries instantly, engaging GPT-4o only when reasoning is required.
          </p>

          {/* Highlights grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-6">
            <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-1">RAG-First Execution</h3>
              <p className="text-zinc-500 text-sm">Direct factual definition requests execute zero LLM calls, saving API resources.</p>
            </div>
            
            <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-1">Semantic Hierarchies</h3>
              <p className="text-zinc-500 text-sm">Organize vectors by Department, Semester, Subject, Unit, and Topic tags.</p>
            </div>

            <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-1">Self-RAG Reflection</h3>
              <p className="text-zinc-500 text-sm">Verifies grounding claims, fallback query triggers Tavily Web Search.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => setAuthMode("login")}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all"
            >
              Get Started Dashboard
            </button>
            <a 
              href="#learn-more"
              onClick={() => alert("Enterprise RAG study platform designed for university students. Admins publish syllabus, students upload notes (private/community).")}
              className="w-full sm:w-auto px-8 py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold transition-all"
            >
              Core Architecture
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 2. Authentication View
  if ((authMode === "login" || authMode === "signup") && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-violet-600 rounded-full blur-[140px] opacity-25 pointer-events-none"></div>

        <div className="relative z-10 w-full max-w-md glass-panel p-8 rounded-3xl space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">
              {authMode === "login" ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              {authMode === "login" ? "Sign in to access your study portal" : "Register a student profile"}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Username</label>
                <input 
                  type="text" 
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500 outline-none transition-all"
                  placeholder="john_doe"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Email Address / Username</label>
              <input 
                type="text" 
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500 outline-none transition-all"
                placeholder={authMode === "signup" ? "name@university.edu" : "name@university.edu or username"}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Secret Password</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Role select removed. All signups are students. */}

            <button 
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
            >
              {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>{authMode === "login" ? "Login Session" : "Create Profile"}</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <button 
              onClick={() => {
                setErrorMsg("");
                setAuthMode(authMode === "login" ? "signup" : "login");
              }}
              className="text-xs text-indigo-400 hover:underline"
            >
              {authMode === "login" ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Authenticated Dashboard Interface
  return (
    <div className="flex h-screen overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-zinc-950/70 border-r border-white/5 flex flex-col justify-between shrink-0 glass-panel">
        <div>
          {/* Dashboard Title Header */}
          <div className="p-6 border-b border-white/5 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                STUDY ASSIST
              </span>
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">{user?.role} Portal</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {user?.role === "student" && (
              <>
                <button 
                  onClick={() => setActiveView("chat")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "chat" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span>AI Chat RAG</span>
                </button>

                <button 
                  onClick={() => setActiveView("documents")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "documents" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <UploadCloud className="w-4.5 h-4.5" />
                  <span>Personal Library</span>
                </button>

                <button 
                  onClick={() => setActiveView("study_generators")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "study_generators" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <Sparkles className="w-4.5 h-4.5" />
                  <span>AI Study Tools</span>
                </button>

                <button 
                  onClick={() => setActiveView("bookmarks")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "bookmarks" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <Bookmark className="w-4.5 h-4.5" />
                  <span>Bookmarks</span>
                </button>

                <button 
                  onClick={() => setActiveView("history")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "history" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <History className="w-4.5 h-4.5" />
                  <span>Query History</span>
                </button>
              </>
            )}

            {user?.role === "admin" && (
              <>
                <button 
                  onClick={() => setActiveView("admin_queue")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "admin_queue" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <Eye className="w-4.5 h-4.5" />
                  <span>Approval Queue</span>
                </button>

                <button 
                  onClick={() => setActiveView("admin_docs")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "admin_docs" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <UploadCloud className="w-4.5 h-4.5" />
                  <span>Official Library</span>
                </button>

                <button 
                  onClick={() => setActiveView("chat")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "chat" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span>RAG Testing Sandbox</span>
                </button>

                <button 
                  onClick={() => setActiveView("admin_analytics")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "admin_analytics" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <BarChart2 className="w-4.5 h-4.5" />
                  <span>System Analytics</span>
                </button>

                <button 
                  onClick={() => setActiveView("admin_students")}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeView === "admin_students" ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                >
                  <Users className="w-4.5 h-4.5" />
                  <span>Student Accounts</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* LOGOUT AREA */}
        <div className="p-4 border-t border-white/5 bg-zinc-950/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-white max-w-[130px] truncate">{user?.username}</div>
              <div className="text-[10px] text-zinc-500 capitalize">{user?.role}</div>
            </div>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl text-xs text-red-400 bg-red-500/5 hover:bg-red-500/10 font-bold transition-all border border-red-500/10"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout Session</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative p-6">
        
        {/* HEADER BAR */}
        <header className="flex items-center justify-between pb-6 border-b border-white/5 mb-6 shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
              {activeView.replace("_", " ")}
            </h1>
            <p className="text-xs text-zinc-500">Academic Study Assistant — Enterprise RAG Platform</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 flex items-center space-x-2 text-xs text-zinc-400 font-semibold">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Datastore: SQLite + Qdrant</span>
            </div>
            {isProcessing && (
              <div className="flex items-center space-x-2 text-xs text-indigo-400 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        </header>

        {/* INNER DYNAMIC VIEWS SWITCH */}

        {/* VIEW 1: AI CHAT RAG */}
        {activeView === "chat" && (
          <div className="flex flex-col h-[calc(100vh-140px)] min-h-0 bg-zinc-950/20 rounded-2xl border border-white/5 overflow-hidden">
            {/* Top Filter and Info Bar */}
            <div className="p-4 border-b border-white/5 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <select 
                  value={filterDept} 
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-300 outline-none"
                >
                  <option value="">Department (All)</option>
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="ME">ME</option>
                </select>
                <input 
                  type="number" 
                  value={filterSem} 
                  onChange={(e) => setFilterSem(e.target.value)}
                  placeholder="Sem"
                  className="w-16 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-300 outline-none"
                />
                <input 
                  type="text" 
                  value={filterSubject} 
                  onChange={(e) => setFilterSubject(e.target.value)}
                  placeholder="Subject (e.g. DBMS)"
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-300 outline-none"
                />
                <input 
                  type="text" 
                  value={filterUnit} 
                  onChange={(e) => setFilterUnit(e.target.value)}
                  placeholder="Unit"
                  className="w-16 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-300 outline-none"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select 
                  value={activeSession}
                  onChange={(e) => setActiveSession(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-300 outline-none"
                >
                  <option value="default_session">Default Session</option>
                  {sessions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button 
                  onClick={createNewChatSession}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-white flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-900/60 border border-white/5 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Ask an Academic Question</h3>
                    <p className="text-xs max-w-sm mt-1">E.g., "What is Normalization?", "Explain quick sort", or search specific subject chapters.</p>
                  </div>
                </div>
              )}

              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${msg.role === "user" ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none" : "bg-zinc-900 border border-white/5 text-zinc-100 rounded-tl-none"}`}>
                    
                    {/* Badge showing LLM Decision Engine path */}
                    {msg.role === "assistant" && (
                      <div className="flex items-center space-x-2 mb-2 pb-1 border-b border-white/5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${msg.decision === "retrieval_only" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-purple-500/20 text-purple-400 border border-purple-500/20"}`}>
                          {msg.decision === "retrieval_only" ? "RAG-Only Direct Output" : "LLM Reasoning Assistance"}
                        </span>
                        {msg.grounding_score !== undefined && (
                          <span className="text-[10px] text-zinc-500">
                            Grounding: {(msg.grounding_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}

                    <div className="prose prose-invert max-w-none text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </div>

                    {/* Citations List */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/5">
                        <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold mb-1.5 flex items-center space-x-1">
                          <BookOpen className="w-3 h-3" />
                          <span>Retrieved Citations & Context Sources</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {msg.citations.map((cit: any, cIdx: number) => (
                            <div key={cIdx} className="p-2 rounded bg-zinc-950/80 border border-white/5 text-[11px] flex flex-col">
                              <span className="font-semibold text-zinc-300 truncate">[{cit.source_index}] {cit.document_name}</span>
                              <span className="text-zinc-500 text-[10px] mt-0.5">
                                Page: {cit.page} • Visibility: {cit.visibility} {cit.subject ? `• ${cit.subject}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Action Controls */}
                  {msg.role === "assistant" && (
                    <div className="flex items-center space-x-3 mt-1.5 px-2">
                      <button 
                        onClick={() => handleBookmarkAnswer(msg)}
                        className="text-[10px] font-semibold text-zinc-500 hover:text-indigo-400 flex items-center space-x-1"
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>Bookmark Answer</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Field */}
            <form onSubmit={handleSendQuery} className="p-4 border-t border-white/5 bg-zinc-950/60 flex items-center space-x-2">
              <input 
                type="text" 
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Ask your Academic Study Assistant..."
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-white outline-none focus:border-indigo-500 text-sm"
              />
              <button 
                type="submit"
                disabled={isProcessing}
                className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* VIEW 2: PERSONAL/OFFICIAL DOCUMENT LIBRARY */}
        {(activeView === "documents" || activeView === "admin_docs") && (
          <div className="space-y-6">
            
            {/* Upload Portal Widget */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center space-x-2">
                <UploadCloud className="w-4.5 h-4.5" />
                <span>Upload New Academic Document</span>
              </h2>

              <form onSubmit={handleUploadSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Select Academic File (PDF, PPTX, DOCX, TXT)</label>
                  <div className="border-2 border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-all cursor-pointer relative">
                    <input 
                      type="file" 
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      required
                    />
                    <UploadCloud className="w-8 h-8 text-zinc-400 mb-2" />
                    <span className="text-xs text-zinc-300">
                      {uploadFile ? uploadFile.name : "Drag & drop files or click to browse files"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Visibility Mode</label>
                  <select 
                    value={uploadVisibility}
                    onChange={(e) => setUploadVisibility(e.target.value)}
                    disabled={user?.role === "admin"}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-300 outline-none"
                  >
                    {user?.role === "admin" ? (
                      <option value="global">Global (Official Library)</option>
                    ) : (
                      <>
                        <option value="private">Private (Only Me)</option>
                        <option value="community">Community (Awaiting Admin Approval)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Department Target</label>
                  <input 
                    type="text" 
                    value={uploadDept}
                    onChange={(e) => setUploadDept(e.target.value)}
                    placeholder="E.g. CSE"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Semester</label>
                  <input 
                    type="number" 
                    value={uploadSem}
                    onChange={(e) => setUploadSem(e.target.value)}
                    placeholder="E.g. 4"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Subject Tag</label>
                  <input 
                    type="text" 
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    placeholder="E.g. Operating Systems"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Unit</label>
                  <input 
                    type="text" 
                    value={uploadUnit}
                    onChange={(e) => setUploadUnit(e.target.value)}
                    placeholder="E.g. Unit 3"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Topic Target</label>
                  <input 
                    type="text" 
                    value={uploadTopic}
                    onChange={(e) => setUploadTopic(e.target.value)}
                    placeholder="E.g. Process Scheduling"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/5 text-white outline-none"
                  />
                </div>

                <div className="md:col-span-3 flex items-center justify-between pt-2">
                  <div className="text-xs text-indigo-400 font-semibold">{uploadProgress}</div>
                  <button 
                    type="submit"
                    disabled={isProcessing || !uploadFile}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white disabled:opacity-50 transition-all"
                  >
                    Upload and Index File
                  </button>
                </div>
              </form>
            </div>

            {/* Document Library Table */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center space-x-2">
                <BookOpen className="w-4.5 h-4.5" />
                <span>Document Library Assets</span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-zinc-500 uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Document Name</th>
                      <th className="py-3 px-4">Uploader</th>
                      <th className="py-3 px-4">Visibility</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Semester</th>
                      <th className="py-3 px-4">Pages</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {documents.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-zinc-500">
                          No indexed documents in target library.
                        </td>
                      </tr>
                    )}
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-white/5 transition-all text-zinc-300">
                        <td className="py-3.5 px-4 font-semibold text-white flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{doc.name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-400">
                          {doc.uploader_role === "admin" ? "Admin" : (doc.uploader_username || "Student")}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            doc.visibility === "global" ? "bg-cyan-500/10 text-cyan-400" :
                            doc.visibility === "community" ? "bg-indigo-500/10 text-indigo-400" : "bg-zinc-700/35 text-zinc-400"
                          }`}>
                            {doc.visibility}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-400">{doc.subject || "—"}</td>
                        <td className="py-3.5 px-4">{doc.semester || "—"}</td>
                        <td className="py-3.5 px-4">{doc.page_count}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            doc.status === "approved" ? "bg-emerald-500/10 text-emerald-400" :
                            doc.status === "pending_approval" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {user?.role === "student" ? (
                            <button 
                              onClick={() => handleOpenDocument(doc.id)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300"
                              title="Open Document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="font-bold text-xs">Open</span>
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 text-red-400 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-300"
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: AI STUDY TOOLS */}
        {activeView === "study_generators" && (
          <div className="space-y-6">
            
            {/* Control Panel Widget */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center space-x-2">
                <Sparkles className="w-4.5 h-4.5" />
                <span>AI Study Assets Builder</span>
              </h2>

              <form onSubmit={handleGenerateStudyTool} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Target Topic or Concept</label>
                  <input 
                    type="text" 
                    value={generatorTopic}
                    onChange={(e) => setGeneratorTopic(e.target.value)}
                    placeholder="E.g., Binary Search Algorithm, Deadlock conditions..."
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/5 text-white outline-none focus:border-indigo-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Optional File Scope</label>
                  <select 
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/5 text-zinc-300 outline-none text-xs"
                  >
                    <option value="">All Database Materials</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button 
                    type="submit"
                    disabled={isProcessing || !generatorTopic}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold disabled:opacity-50 transition-all text-xs flex items-center justify-center space-x-2"
                  >
                    {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Generate Academic Assets</span>
                  </button>
                </div>
              </form>

              {/* Study Tool Tabs Selection */}
              <div className="flex border-b border-white/5 mt-6 gap-6 text-xs font-bold text-zinc-400">
                <button 
                  onClick={() => setStudyToolTab("quiz")}
                  className={`pb-2.5 transition-all ${studyToolTab === "quiz" ? "text-indigo-400 border-b-2 border-indigo-500" : "hover:text-zinc-200"}`}
                >
                  Interactive Quiz
                </button>
                <button 
                  onClick={() => setStudyToolTab("viva")}
                  className={`pb-2.5 transition-all ${studyToolTab === "viva" ? "text-indigo-400 border-b-2 border-indigo-500" : "hover:text-zinc-200"}`}
                >
                  Viva Q&A Cards
                </button>
                <button 
                  onClick={() => setStudyToolTab("revision")}
                  className={`pb-2.5 transition-all ${studyToolTab === "revision" ? "text-indigo-400 border-b-2 border-indigo-500" : "hover:text-zinc-200"}`}
                >
                  Revision & Cheat Sheets
                </button>
                <button 
                  onClick={() => setStudyToolTab("planner")}
                  className={`pb-2.5 transition-all ${studyToolTab === "planner" ? "text-indigo-400 border-b-2 border-indigo-500" : "hover:text-zinc-200"}`}
                >
                  Roadmap Planner
                </button>
                <button 
                  onClick={() => setStudyToolTab("pyq")}
                  className={`pb-2.5 transition-all ${studyToolTab === "pyq" ? "text-indigo-400 border-b-2 border-indigo-500" : "hover:text-zinc-200"}`}
                >
                  PYQ Exam Trends
                </button>
              </div>
            </div>

            {/* Generated Output Area */}
            {generatedOutput && (
              <div className="glass-panel p-6 rounded-2xl space-y-6">
                
                {/* Save Header Action */}
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="font-extrabold text-sm uppercase text-zinc-200">
                    Generated {studyToolTab} deck
                  </h3>
                  {["quiz", "revision", "planner"].includes(studyToolTab) && (
                    <button 
                      onClick={saveGeneratedAsset}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300 font-bold hover:bg-white/10 text-xs flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save asset to Library</span>
                    </button>
                  )}
                </div>

                {/* Sub Tab Output: 1. QUIZ */}
                {studyToolTab === "quiz" && (
                  <div className="space-y-6">
                    <h4 className="font-bold text-white">{generatedOutput.title}</h4>
                    <div className="space-y-4">
                      {generatedOutput.questions?.map((q: any, qIdx: number) => (
                        <div key={qIdx} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-indigo-400">Question {qIdx + 1} ({q.type})</span>
                            {showQuizExplanations[qIdx] && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                quizResponses[qIdx] === q.answer ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                              }`}>
                                {quizResponses[qIdx] === q.answer ? "Correct Answer" : "Incorrect Answer"}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white">{q.question}</p>

                          {/* Multiple Choice Render */}
                          {q.type === "mcq" && q.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                              {q.options.map((opt: string) => (
                                <button 
                                  key={opt}
                                  onClick={() => checkAnswerQuiz(qIdx, opt)}
                                  className={`px-4 py-2.5 rounded-xl border text-xs text-left font-semibold transition-all ${
                                    quizResponses[qIdx] === opt ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-900 border-white/5 text-zinc-300 hover:border-zinc-500"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* True / False Render */}
                          {q.type === "true_false" && q.options && (
                            <div className="flex gap-4 pt-2">
                              {q.options.map((opt: string) => (
                                <button 
                                  key={opt}
                                  onClick={() => checkAnswerQuiz(qIdx, opt)}
                                  className={`px-6 py-2 rounded-xl border text-xs font-semibold transition-all ${
                                    quizResponses[qIdx] === opt ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-900 border-white/5 text-zinc-300 hover:border-zinc-500"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Coding / Short Answer Render */}
                          {["coding", "fill_in_blanks"].includes(q.type) && (
                            <div className="space-y-2 pt-2">
                              <input 
                                type="text"
                                placeholder="Type your answer code/text..."
                                onBlur={(e) => checkAnswerQuiz(qIdx, e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/5 text-white outline-none focus:border-indigo-500 text-xs font-mono"
                              />
                              <div className="text-[10px] text-zinc-500">Press tab or click out to lock answer.</div>
                            </div>
                          )}

                          {/* Explanation Output */}
                          {showQuizExplanations[qIdx] && (
                            <div className="p-3 bg-zinc-950/60 rounded-lg border border-white/5 text-xs space-y-1.5 mt-2">
                              <div><span className="font-bold text-emerald-400">Correct Answer:</span> <code className="font-mono text-white bg-zinc-900 px-1 py-0.5 rounded">{q.answer}</code></div>
                              <p className="text-zinc-400 leading-relaxed"><span className="font-bold text-zinc-300">Explanation:</span> {q.explanation}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub Tab Output: 2. VIVA CARDS */}
                {studyToolTab === "viva" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generatedOutput.questions?.map((q: any, idx: number) => (
                      <div 
                        key={idx} 
                        onClick={() => toggleVivaReveal(idx)}
                        className="p-5 rounded-2xl border border-white/5 bg-zinc-900/60 cursor-pointer min-h-[140px] flex flex-col justify-between hover:border-indigo-500/40 transition-all select-none"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-bold text-indigo-400">{q.level} Viva Q</span>
                            <span className="text-[9px] text-zinc-500">Click card to Flip</span>
                          </div>
                          <p className="text-sm font-semibold text-white">{q.question}</p>
                        </div>
                        {vivaFlipped[idx] && (
                          <div className="mt-4 pt-3 border-t border-white/5 text-xs text-zinc-300 bg-zinc-950/40 p-2.5 rounded-lg leading-relaxed animate-fade-in">
                            <span className="font-bold text-emerald-400 block mb-1">Examiner Reference Answer:</span>
                            {q.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Sub Tab Output: 3. REVISION */}
                {studyToolTab === "revision" && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs leading-relaxed text-zinc-300">
                      <span className="font-bold text-indigo-400 block text-sm mb-1">Topic Summary Overview</span>
                      {generatedOutput.summary}
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-900 border border-white/5 text-xs font-mono whitespace-pre-wrap leading-relaxed text-zinc-200">
                      <span className="font-bold text-zinc-400 block text-sm mb-2 font-sans">Quick-Reference Cheat Sheet</span>
                      {generatedOutput.cheat_sheet}
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-white text-xs uppercase tracking-wider">Subtopic Learning Notes</h4>
                      {generatedOutput.notes?.map((n: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs leading-relaxed">
                          <span className="font-bold text-white block text-sm mb-1">{n.topic}</span>
                          <p className="text-zinc-400">{n.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub Tab Output: 4. ROADMAP PLANNER */}
                {studyToolTab === "planner" && (
                  <div className="space-y-6">
                    <h4 className="font-bold text-white"> master schedule: {generatedOutput.topic}</h4>
                    <div className="relative border-l border-white/5 ml-4 pl-6 space-y-6 text-xs">
                      {generatedOutput.plan_data?.map((p: any, idx: number) => (
                        <div key={idx} className="relative">
                          {/* Timeline dot */}
                          <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-indigo-500 border border-zinc-950 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="font-bold text-sm text-indigo-400">{p.day}: {p.objective}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                              {p.tasks?.map((t: string, tIdx: number) => (
                                <div key={tIdx} className="p-3 rounded-lg bg-zinc-900 border border-white/5 flex items-center space-x-2 text-zinc-300">
                                  <input type="checkbox" className="rounded bg-zinc-950 border-white/10" />
                                  <span>{t}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub Tab Output: 5. PYQ ANALYSIS */}
                {studyToolTab === "pyq" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Repeated Qs */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>Repeated Exam Questions</span>
                      </h4>
                      <div className="space-y-2">
                        {generatedOutput.repeated_questions?.map((q: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/5 text-xs space-y-1.5">
                            <p className="font-semibold text-white">{q.question}</p>
                            <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                              <span>Frequency: {q.frequency}</span>
                              <span className="font-bold text-indigo-400">Weightage: {q.weightage}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Predictions */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-violet-400 flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Topic Probability Forecasts</span>
                      </h4>
                      <div className="space-y-2">
                        {generatedOutput.important_topics?.map((t: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/5 text-xs flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-white">{t.topic}</p>
                              <p className="text-[10px] text-zinc-500 mt-1">Trend: {t.difficulty_trend}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 font-bold text-[10px]">
                              {t.probability}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: BOOKMARKS */}
        {activeView === "bookmarks" && (
          <div className="grid grid-cols-1 gap-4">
            {bookmarks.length === 0 && (
              <div className="text-center p-12 text-zinc-500">
                No bookmarked answers saved.
              </div>
            )}
            {bookmarks.map((bm) => (
              <div key={bm.id} className="glass-panel p-6 rounded-2xl relative">
                <button 
                  onClick={() => handleDeleteBookmark(bm.id)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <h3 className="font-bold text-indigo-400 text-xs uppercase tracking-wider mb-2">Bookmarked Study Material</h3>
                <p className="text-sm font-semibold text-zinc-400 mb-2">Query Context Session</p>
                <div className="prose prose-invert max-w-none text-zinc-200 text-xs whitespace-pre-wrap">
                  {bm.answer}
                </div>

                {bm.citations && bm.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                    {bm.citations.map((c: any, cIdx: number) => (
                      <span key={cIdx} className="px-2.5 py-1 rounded bg-zinc-950/80 border border-white/5 text-[9px] text-zinc-400">
                        Source {c.source_index}: {c.document_name} (Page {c.page})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* VIEW 5: HISTORY */}
        {activeView === "history" && (
          <div className="space-y-4">
            {sessions.length === 0 && (
              <div className="text-center p-12 text-zinc-500">
                No previous conversations exist.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sessions.map((sess) => (
                <div 
                  key={sess}
                  onClick={() => {
                    setActiveSession(sess);
                    setActiveView("chat");
                  }}
                  className="glass-panel p-5 rounded-2xl cursor-pointer hover:border-indigo-500 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-white truncate block">{sess}</span>
                      <span className="text-[10px] text-zinc-500 block">Click to reload transcript</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 6: ADMIN APPROVAL QUEUE */}
        {activeView === "admin_queue" && (
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center space-x-2">
              <Eye className="w-4.5 h-4.5" />
              <span>Pending Student Community Uploads</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-500 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Document Title</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-4">Subject Target</th>
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminQueue.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        All student submissions processed. Queue is currently empty.
                      </td>
                    </tr>
                  )}
                  {adminQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-all text-zinc-300">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-zinc-400" />
                        <span>{item.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-400">
                        {item.uploader_username || "Student"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-400">{item.subject || "—"}</td>
                      <td className="py-3.5 px-4">{item.semester || "—"}</td>
                      <td className="py-3.5 px-4">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 flex items-center space-x-2">
                        <button 
                          onClick={() => handleApproveReject(item.id, "approve")}
                          className="px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500/20 transition-all text-[11px]"
                        >
                          Approve Upload
                        </button>
                        <button 
                          onClick={() => handleApproveReject(item.id, "reject")}
                          className="px-3 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold hover:bg-red-500/20 transition-all text-[11px]"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 7: ADMIN ANALYTICS */}
        {activeView === "admin_analytics" && adminAnalytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="glass-panel p-6 rounded-2xl">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Total Registered Users</span>
                <div className="text-3xl font-black text-white mt-1">{adminAnalytics.users?.total}</div>
                <div className="text-[10px] text-zinc-400 mt-1">Students: {adminAnalytics.users?.students} • Admins: {adminAnalytics.users?.admins}</div>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Official Library Documents</span>
                <div className="text-3xl font-black text-cyan-400 mt-1">{adminAnalytics.documents?.official}</div>
                <div className="text-[10px] text-zinc-400 mt-1">Global Knowledge Sources</div>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Community Notes (Approved)</span>
                <div className="text-3xl font-black text-indigo-400 mt-1">{adminAnalytics.documents?.community_approved}</div>
                <div className="text-[10px] text-zinc-400 mt-1">Awaiting verification queue: {adminAnalytics.documents?.pending_approval}</div>
              </div>

              <div className="glass-panel p-6 rounded-2xl">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Qdrant Indexed Vector Chunks</span>
                <div className="text-3xl font-black text-violet-400 mt-1">{adminAnalytics.vector_chunks}</div>
                <div className="text-[10px] text-zinc-400 mt-1">Dimension size: 1536</div>
              </div>
            </div>

            {/* General Description Card */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-bold text-zinc-200 text-sm mb-3">SYSTEM INFRASTRUCTURE REVIEW</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                This platform is running an intelligent Decision Engine that filters intent to optimize cost and latency. Factual matching uses vector and keyword searches under reciprocal rank fusion (RRF) with metadata validation before deciding to execute LLM API queries.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-zinc-950 border border-white/5 text-[10px] text-zinc-500 font-bold">QDRANT MEMORY MODE</span>
                <span className="px-2 py-0.5 rounded bg-zinc-950 border border-white/5 text-[10px] text-zinc-500 font-bold">SECURITY PIPELINE ON</span>
                <span className="px-2 py-0.5 rounded bg-zinc-950 border border-white/5 text-[10px] text-zinc-500 font-bold">API CACHING ACTIVE</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 8: ADMIN STUDENTS LIST */}
        {activeView === "admin_students" && (
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center space-x-2">
              <Users className="w-4.5 h-4.5" />
              <span>Registered Student Profiles</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-500 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">User ID</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Registration Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminStudents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500">
                        No students registered.
                      </td>
                    </tr>
                  )}
                  {adminStudents.map((stud) => (
                    <tr key={stud.id} className="hover:bg-white/5 transition-all text-zinc-300">
                      <td className="py-3.5 px-4 font-mono">{stud.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">{stud.username}</td>
                      <td className="py-3.5 px-4">{stud.email}</td>
                      <td className="py-3.5 px-4">{new Date(stud.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
