/**
 * App: DoIt
 * Author: Rodini Vince Rosario
 * Description: Handles task CRUD, calendar, sticky notes, theme toggling, and Supabase integration.
 * Date: 2025-10-17
 */

// ----------------------------
// SUPABASE INITIALIZATION
// ----------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kjhraaibtasbtstrunja.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqaHJhYWlidGFzYnRzdHJ1bmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTI2NTAsImV4cCI6MjA3NjEyODY1MH0.8cb5dfdZ0yezZ_OuHYJx_UgHApJjC7u9wb_ZhYBgiqQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    function showPopupAuthentication(message, type = "warning") {
    const popup = document.getElementById("popupAuth");
    if (!popup) return;

    popup.textContent = message;
    popup.className = 'popupAuth';
    void popup.offsetWidth; // force reflow
    popup.classList.add("show", type);

    setTimeout(() => popup.classList.remove("show"), 3000);
  }

// ----------------------------
// AUTHENTICATION HANDLERS
// ----------------------------
// Login handler

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showPopupAuthentication("Login failed: " + error.message, "error");
      return;
    }

    showPopupAuthentication("Welcome back!");
      setTimeout(() => window.location.href = "app.html", 1000);
  });
}

// Sign-up handler

const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!name || !email || !password) {
      showPopupAuthentication("Please fill in all fields.", "error");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/app.html`,
      },
    });

    if (error) {
      showPopupAuthentication("❌ Sign-up failed: " + error.message, "error");
      console.error(error);
      return;
    }

      showPopupAuthentication("Sign-up successful!");      
      setTimeout(() => window.location.href = "app.html", 1000);
  });
}
