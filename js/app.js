/**
 * App: DoIt
 * Author: Rodini Vince Rosario
 * Description: Handles task CRUD, calendar, sticky notes, theme toggling, and Supabase integration.
 * Date: 2025-10-17
 */

// ----------------------------
// SUPABASE INITIALIZATION
// ----------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://kjhraaibtasbtstrunja.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqaHJhYWlidGFzYnRzdHJ1bmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTI2NTAsImV4cCI6MjA3NjEyODY1MH0.8cb5dfdZ0yezZ_OuHYJx_UgHApJjC7u9wb_ZhYBgiqQ'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ----------------------------
// UTILITY FUNCTIONS
// ----------------------------

// Format date to YYYY-MM-DD (local time)
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get today’s date in YYYY-MM-DD format
function getToday() {
  return formatDateLocal(new Date()); // use local format
}

//----------------------------
// DELETE CONFIRMATION POPUP
//----------------------------
function showDeleteConfirm() {
  return new Promise((resolve) => {
    const popup = document.getElementById('deleteConfirmPopup');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');

    popup.style.display = 'flex';

    const closePopup = (result) => {
      popup.style.display = 'none';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };

    const onConfirm = () => closePopup(true);
    const onCancel = () => closePopup(false);

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// ----------------------------
// TASK MANAGEMENT
// ----------------------------
const addBtn = document.getElementById('addBtn')
const taskInput = document.getElementById('taskInput')
const taskDetailsInput = document.getElementById('taskInputDetails')
const dueDateInput = document.getElementById('dueDate')
let taskList = document.querySelector('.task-list')

// Ensure there’s a container for tasks
if (!taskList) {
  taskList = document.createElement('ul')
  taskList.classList.add('task-list')
  document.querySelector('#today').appendChild(taskList)
}

// Add task event
addBtn.addEventListener('click', async () => {
  const title = taskInput.value.trim()
  const details = taskDetailsInput.value.trim()
  const due_date = dueDateInput.value

  if (title === '') return showPopup('Please enter a task name!', 'warning')
  if (due_date === '') return showPopup('Please select a due date!', 'warning')
  if (due_date < getToday()) return showPopup('Due date cannot be in the past!', 'error')

  if (details === '') {
    const proceed = confirm('No details provided. Continue?')
    if (!proceed) return
  }

  // Get logged-in user
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    showPopup('You must be logged in to add tasks.', 'warning')
    return
  }

  // Clear input fields
  taskInput.value = ''
  taskDetailsInput.value = ''
  dueDateInput.value = ''

  // Save to Supabase (each task belongs to current user)
  const { data, error } = await supabase
    .from('tasks')
    .insert([
      {
        task: title,
        description: details,
        due_date,
        is_completed: false,
        uid: userData.user.id, // link task to logged-in user
      },
    ])
    .select()

  if (error) {
    showPopup('Failed to save task: ' + error.message, 'error')
  } else {
    showPopup('Task added successfully!', 'success')
    await loadTodayTasks()
    await loadUpcomingTasks()
    await renderCalendar()
  }
})

// Render today’s tasks
async function loadTodayTasks() {
  const today = getToday();

  // Get the logged-in user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    console.warn('No user logged in — cannot load tasks.');
    return;
  }

  const userId = userData.user.id;

  // Fetch this user’s tasks due today
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', today)
    .eq('uid', userId);

  if (error) {
    console.error('Error fetching tasks:', error);
    showPopup('Failed to load today’s tasks.', 'error');
    return;
  }

  const taskList = document.querySelector('#today .task-list');
  taskList.innerHTML = ''; // clear list

  if (!tasks || tasks.length === 0) {
    taskList.innerHTML = '<li>No tasks for today 🎉</li>';
    return;
  }

  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `task-${task.id}`;
    checkbox.checked = task.is_completed;

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = `${task.task} — ${task.description || ''}`;

    // Create Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-task-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete Task';

    // Append elements
    li.appendChild(checkbox);
    li.appendChild(label);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);

    // Handle task completion toggle
    checkbox.addEventListener('change', async () => {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ is_completed: checkbox.checked })
        .eq('id', task.id)
        .eq('uid', userId);

      if (updateError) {
        console.error('Error updating completion:', updateError);
        showPopup('Failed to update task status!', 'error');
      } else {
        showPopup(
          checkbox.checked
            ? 'Task marked complete!'
            : 'Task marked incomplete!',
          'success'
        );
      }
    });

    // Handle delete
    deleteBtn.addEventListener('click', async () => {
      const confirmDelete = await showDeleteConfirm(); // wait for popup response
      if (!confirmDelete) return; // user canceled

      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .eq('uid', userId);

      if (deleteError) {
        console.error('Error deleting task:', deleteError);
        showPopup('Failed to delete task.', 'error');
      } else {
        li.remove(); // remove from DOM
        showPopup('Task deleted successfully!', 'success');
      }
    });
  });
}

// Render upcoming tasks
async function loadUpcomingTasks() {
  const today = getToday();

  // Ensure we have the logged-in user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    console.warn("No user logged in — cannot load upcoming tasks.");
    return;
  }

  const userId = userData.user.id;

  // Fetch only this user's future tasks
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .gt('due_date', today)
    .eq('uid', userId) // filter by user
    .order('due_date', { ascending: true })
    .limit(6);

  if (error) {
    console.error("Error fetching tasks:", error);
    showPopup("Failed to load upcoming tasks!", "error");
    return;
  }

  const taskList = document.querySelector('#upcoming .task-cards');
  taskList.innerHTML = ''; // clear list

  // Handle no tasks
  if (!tasks || tasks.length === 0) {
    const divTemp = document.createElement('div');
    divTemp.className = 'task-card';
    divTemp.innerHTML = '<h3>No upcoming tasks 🎉</h3>';
    taskList.appendChild(divTemp);
    return;
  }

  // Render each task card
  tasks.forEach((task) => {
    const div = document.createElement('div');
    div.className = 'task-card';

    const heading = document.createElement('h3');
    heading.textContent = task.task;
    div.appendChild(heading);

    if (task.description) {
      const desc = document.createElement('p');
      desc.textContent = task.description;
      div.appendChild(desc);
    }

    const due = document.createElement('p');
    due.innerHTML = `<strong>Due:</strong> ${task.due_date}`;
    div.appendChild(due);

    taskList.appendChild(div);
  });
}

function showPopup(message, type = "warning") {
  const popup = document.getElementById("popup");
  popup.textContent = message;
  
  popup.className = `popup show ${type}`; // apply class for color
  setTimeout(() => popup.classList.remove("show"), 3000); // auto-hide after 3s
}

// Real-time listener for new task inserts/updates/deletes
function subscribeToTaskChanges() {
  const today = getToday();

  const channel = supabase
    .channel('tasks-changes') // ✅ custom channel name (not schema)
    .on(
      'postgres_changes',
      {
        event: '*', // listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'tasks',
      },
      (payload) => {
        const task = payload.new || payload.old;

        if (!task) return;

        // ✅ Refresh only the relevant section
        if (task.due_date === today) {
          loadTodayTasks();
        } else if (task.due_date > today) {
          loadUpcomingTasks();
          renderCalendar();
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('📡 Listening for task changes in real time...');
      }
    });
}


// ----------------------------
// STICKY NOTES MANAGEMENT
// ----------------------------
const addNoteBtn = document.getElementById("addNoteBtn");
const stickyWall = document.querySelector(".sticky-wall");

// Random sticky colors
function getRandomStickyColor() {
  const colors = [
    { bg: "#fff9c4", border: "#f1e582" },
    { bg: "#ffe0b2", border: "#ffb74d" },
    { bg: "#c8e6c9", border: "#81c784" },
    { bg: "#bbdefb", border: "#64b5f6" },
    { bg: "#f8bbd0", border: "#f06292" },
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

const MAX_LENGTH = 150; // max characters per note

// Add new sticky note
addNoteBtn.addEventListener("click", async () => {
  const { bg, border } = getRandomStickyColor();

  const note = document.createElement("div");
  note.className = "sticky-note";
  const rotation = `${(Math.random() * 10 - 5).toFixed(2)}deg`;
  note.style.setProperty('--rotation', rotation);
  note.style.background = bg;
  note.style.border = `2px solid ${border}`;

  const p = document.createElement("p");
  p.contentEditable = true;
  p.textContent = "New note...";
  note.appendChild(p);

  const delBtn = document.createElement("button");
  delBtn.textContent = "✖";
  delBtn.className = "delete-btn";
  delBtn.addEventListener("click", () => note.remove());
  note.appendChild(delBtn);

  stickyWall.appendChild(note);

  // Clear placeholder
  const clearPlaceholder = () => {
    if (p.textContent === "New note...") p.textContent = "";
  };
  p.addEventListener("focus", clearPlaceholder);

  // Limit characters while typing
  p.addEventListener("input", () => {
    if (p.textContent.length > MAX_LENGTH) {
      p.textContent = p.textContent.slice(0, MAX_LENGTH);

      // Move caret to the end
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(p.childNodes[0] || p, p.textContent.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      showPopup(`Max ${MAX_LENGTH} characters allowed!`, "warning");
    }
  });

  // Save when user leaves note
  const saveOnBlur = async () => {
    const content = p.textContent.trim();
    if (!content) {
      note.remove();
      return;
    }

    // Save to Supabase
    const savedNote = await saveNoteToSupabase(content, bg, border, rotation);
    if (!savedNote) {
      note.remove();
      return;
    }

    note.dataset.id = savedNote.id;

    // Replace blur listener with auto-save for edits
    p.removeEventListener("blur", saveOnBlur);
    p.addEventListener("blur", async (e) => {
      const newText = e.target.textContent.trim().slice(0, MAX_LENGTH); // enforce limit on edit
      const { error } = await supabase
        .from("sticky_notes")
        .update({ content: newText })
        .eq("id", savedNote.id)
        .eq("uid", savedNote.user_id);
      if (error) showPopup("Failed to update note: " + error.message, "error");
    });
  };

  p.addEventListener("blur", saveOnBlur);
  p.focus();
});


// Create sticky note element
function createStickyElement(noteData) {
  const note = document.createElement("div");
  note.className = "sticky-note";
  note.style.background = noteData.bg_color;
  note.style.border = `2px solid ${noteData.bg_border}`;
  note.style.setProperty('--rotation', noteData.rotation || '0deg');

  const p = document.createElement("p");
  p.contentEditable = true;
  p.textContent = noteData.content;
  note.appendChild(p);

  const delBtn = document.createElement("button");
    delBtn.textContent = "✖";
    delBtn.className = "delete-btn";
    delBtn.addEventListener("click", async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        showPopup("You must be logged in to delete notes!", "warning");
        return;
      }

      const { error } = await supabase
        .from("sticky_notes")
        .delete()
        .eq("id", noteData.id)
        .eq("uid", user.id); // always use the logged-in user’s ID

      if (error) {
        showPopup("Failed to delete note: " + error.message, "error");
        return;
      }
      note.remove();
    });

  note.appendChild(delBtn);

  p.addEventListener("blur", async () => {
  const newText = p.textContent.trim();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return;

  const { error } = await supabase
    .from("sticky_notes")
    .update({ content: newText })
    .eq("id", noteData.id)
    .eq("uid", user.id); // always use the logged-in user’s ID

  if (error) showPopup("Failed to update note: " + error.message, "error");
});


  stickyWall.appendChild(note);
}

// Save note to Supabase (linked to current user)
async function saveNoteToSupabase(content, bg, border, rotation) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    showPopup("You must be logged in to save notes!", "warning");
    return null;
  }

  const { data, error } = await supabase
    .from("sticky_notes")
    .insert([
      {
        content,
        bg_color: bg,
        bg_border: border,
        rotation,
        uid: user.id, // Link to authenticated user
      },
    ])
    .select()
    .single();

  if (error) {
    showPopup("Error saving note: " + error.message, "error");
    return null;
  }

  return data;
}

// Load all notes (only current user’s)
async function loadStickyNotes() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return;

  const { data: notes, error } = await supabase
    .from("sticky_notes")
    .select("*")
    .eq("uid", user.id); // Only load this user's notes

  if (error) {
    showPopup("Error loading notes: " + error.message, "error");
    return;
  }

  notes.forEach(createStickyElement);
}


// ----------------------------
// CALENDAR MANAGEMENT
// ----------------------------
const calendarGrid = document.querySelector('.calendar-grid');
const monthYearDisplay = document.getElementById('monthYear');
const popup = document.getElementById('calendarPopup');
const popupDate = document.getElementById('popupDate');
const popupTasks = document.getElementById('popupTasks');
const closePopup = document.getElementById('closePopup');

let currentMonth = new Date(); // starts at current month

// Navigate months
document.getElementById('prevMonth').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});

// Navigate months
document.getElementById('nextMonth').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});

// Close popup
closePopup.addEventListener('click', () => {
  popup.style.display = 'none';
});

// Render calendar for current month
async function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  monthYearDisplay.textContent = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  calendarGrid.innerHTML = '';

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // ✅ Get logged-in user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('User not logged in');
    return;
  }

  // Load only this user’s tasks
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('uid', user.id);

  if (error) {
    console.error('Error loading tasks:', error.message);
    return;
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    const formatted = formatDateLocal(date); // ✅ use local format

    const dayEl = document.createElement('div');
    dayEl.classList.add('calendar-day');
    dayEl.textContent = i;

    const hasTask = tasks.some(t => t.due_date === formatted);
    if (hasTask) dayEl.classList.add('has-task');

    // Pass refresh function for instant update
    dayEl.addEventListener('click', () =>
      showTasksForDate(formatted, tasks, renderCalendar)
    );

    calendarGrid.appendChild(dayEl);
  }
}

// Show tasks for selected date in popup
async function showTasksForDate(date, allTasks, refreshCalendar) {
  const tasksForDate = allTasks.filter(t => t.due_date === date);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  popupDate.textContent = `Tasks for ${date}`;
  popupTasks.innerHTML = '';

  if (tasksForDate.length === 0) {
    popupTasks.innerHTML = '<p>No tasks for this date 🎉</p>';
  } else {
    for (const task of tasksForDate) {
      const taskRow = document.createElement('div');
      taskRow.classList.add('popup-task-item');
      taskRow.innerHTML = `
        <p>📝 ${task.task}</p>
        <button class="delete-task-btn" title="Delete task">🗑️</button>
      `;

      const deleteBtn = taskRow.querySelector('.delete-task-btn');
      deleteBtn.addEventListener('click', async () => {
        const confirmDelete = await showDeleteConfirm();
        if (!confirmDelete) return;

        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id)
          .eq('uid', userId);

        if (deleteError) {
          console.error('Error deleting task:', deleteError);
          showPopup('Failed to delete task.', 'error');
        } else {
          // Instantly remove from popup
          taskRow.remove();
          showPopup('Task deleted successfully!', 'success');

          // Remove from local array
          const index = allTasks.findIndex(t => t.id === task.id);
          if (index !== -1) allTasks.splice(index, 1);

          // Re-render calendar
          if (typeof refreshCalendar === 'function') {
            await refreshCalendar();
          }

          // Refresh Today’s task list immediately
          await loadTodayTasks();
          await loadUpcomingTasks();

          // If no tasks left, show message
          if (!popupTasks.querySelector('.popup-task-item')) {
            popupTasks.innerHTML = '<p>No tasks for this date 🎉</p>';
          }
        }
      });


    popupTasks.appendChild(taskRow);
  }
}

  popup.style.display = 'block';
}


// ----------------------------
// THEME TOGGLING WITH PERSISTENCE
// ----------------------------

// Apply saved local theme immediately to avoid flash
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') document.body.classList.add('dark-mode');

// On DOM load, sync theme with Supabase
document.addEventListener('DOMContentLoaded', async () => {
  const darkToggle = document.getElementById("darkModeToggle");
  if (!darkToggle) return;

  // Apply theme from localStorage immediately to avoid flash
  const savedLocalTheme = localStorage.getItem('theme');
  if (savedLocalTheme === 'dark') document.body.classList.add('dark-mode');

  // Get logged-in user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  let theme = savedLocalTheme || 'light';

  if (user && !userError) {
    try {
      // Fetch the latest theme for this user
      const { data: settings } = await supabase
        .from('settings')
        .select('theme')
        .eq('uid', user.id)
        .limit(1)
        .single(); // returns null if no row exists

      // Use Supabase theme if it exists
      theme = settings?.theme || theme;
    } catch (err) {
      // No row exists or fetch failed, fallback to localStorage
      console.log("No existing theme found, using localStorage/default: ", theme);
    }
  }

  // Apply theme to UI
  document.body.classList.toggle('dark-mode', theme === 'dark');
  darkToggle.checked = theme === 'dark';
  localStorage.setItem('theme', theme);

  // Handle toggle changes
  darkToggle.addEventListener('change', async () => {
    const isDark = darkToggle.checked;

    // Apply immediately
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Save to Supabase if logged in
    if (user) {
      const { error } = await supabase
        .from('settings')
        .upsert(
          { uid: user.id, theme: isDark ? 'dark' : 'light' },
          { onConflict: 'uid' } // Insert if doesn't exist, update if it does
        );
      if (error) console.error('Failed to save theme:', error.message);
    }
  });

  // Logout button: save theme before logging out
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const isDark = document.body.classList.contains('dark-mode');

      if (user) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { uid: user.id, theme: isDark ? 'dark' : 'light' },
            { onConflict: 'uid' }
          );
        if (error) console.error('Failed to save theme before logout:', error.message);
      }

      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) {
        showPopup('Failed to log out: ' + logoutError.message, 'error');
        return;
      }

      showPopup('Logged out successfully!', 'success');
      window.location.href = '/index.html';
    });
  }
});

// ----------------------------
// INITIAL LOADS
// ----------------------------
renderCalendar(); // initial calendar render
loadStickyNotes(); // load sticky notes
loadTodayTasks(); // load today’s tasks
loadUpcomingTasks(); // load upcoming tasks
subscribeToTaskChanges(); // start real-time listener
