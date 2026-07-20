const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getHeaders(isMultipart = false) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: HeadersInit = {};
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  
  return headers;
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const data = await response.json();
      errorDetail = data.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }
  return response.json();
}

export const api = {
  // Authentication
  auth: {
    async signup(payload: any) {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async login(payload: any) {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async sync(token: string) {
      const res = await fetch(`${API_BASE_URL}/auth/sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      return handleResponse(res);
    }
  },


  // Documents
  documents: {
    async upload(formData: FormData) {
      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        headers: getHeaders(true),
        body: formData
      });
      return handleResponse(res);
    },
    async list() {
      const res = await fetch(`${API_BASE_URL}/documents`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async delete(docId: number) {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      return handleResponse(res);
    }
  },

  // Chat
  chat: {
    async query(payload: any) {
      const res = await fetch(`${API_BASE_URL}/chat/query`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async getSessions() {
      const res = await fetch(`${API_BASE_URL}/chat/sessions`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async getHistory(sessionId: string) {
      const res = await fetch(`${API_BASE_URL}/chat/history/${sessionId}`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async saveBookmark(payload: any) {
      const res = await fetch(`${API_BASE_URL}/chat/bookmarks`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async listBookmarks() {
      const res = await fetch(`${API_BASE_URL}/chat/bookmarks`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async deleteBookmark(bookmarkId: number) {
      const res = await fetch(`${API_BASE_URL}/chat/bookmarks/${bookmarkId}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      return handleResponse(res);
    }
  },

  // Study Tools & Generators
  study: {
    async generateQuiz(payload: any) {
      const res = await fetch(`${API_BASE_URL}/study/quiz/generate`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async generateViva(payload: any) {
      const res = await fetch(`${API_BASE_URL}/study/viva/generate`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async generateRevision(payload: any) {
      const res = await fetch(`${API_BASE_URL}/study/revision/generate`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async generatePlanner(payload: any) {
      const res = await fetch(`${API_BASE_URL}/study/planner/generate`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async analyzePYQs(payload: any) {
      const res = await fetch(`${API_BASE_URL}/study/pyq/analyze`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    // Saved Assets List and Save
    async saveQuiz(payload: any) {
      const res = await fetch(`${API_BASE_URL}/study/quizzes`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async listSavedQuizzes() {
      const res = await fetch(`${API_BASE_URL}/study/quizzes`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async saveFlashcardDeck(payload: any) {
      const res = await fetch(`${API_BASE_URL}/study/flashcards`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async listSavedFlashcardDecks() {
      const res = await fetch(`${API_BASE_URL}/study/flashcards`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async saveStudyPlan(payload: any) {
      const res = await fetch(`${API_BASE_URL}/study/planner`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    },
    async listSavedStudyPlans() {
      const res = await fetch(`${API_BASE_URL}/study/planner`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    }
  },

  // Admin Tools
  admin: {
    async getQueue() {
      const res = await fetch(`${API_BASE_URL}/admin/queue`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async approveDocument(documentId: number, action: "approve" | "reject") {
      const res = await fetch(`${API_BASE_URL}/admin/approve`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ document_id: documentId, action })
      });
      return handleResponse(res);
    },
    async getAnalytics() {
      const res = await fetch(`${API_BASE_URL}/admin/analytics`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    },
    async getStudents() {
      const res = await fetch(`${API_BASE_URL}/admin/students`, {
        method: "GET",
        headers: getHeaders()
      });
      return handleResponse(res);
    }
  }
};
