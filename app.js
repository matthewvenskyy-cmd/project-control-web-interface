const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const taskList = document.querySelector("#taskList");
const taskCount = document.querySelector("#taskCount");
const clearDone = document.querySelector("#clearDone");
const layout = document.querySelector("#layout");
const taskPanel = document.querySelector("#taskPanel");
const toggleTasks = document.querySelector("#toggleTasks");
const canvas = document.querySelector("#drawCanvas");
const colorPicker = document.querySelector("#colorPicker");
const brushSize = document.querySelector("#brushSize");
const eraseMode = document.querySelector("#eraseMode");
const clearCanvas = document.querySelector("#clearCanvas");
const saveCanvas = document.querySelector("#saveCanvas");
const toggleCanvas = document.querySelector("#toggleCanvas");
const canvasPanel = document.querySelector("#canvasPanel");
const typingPanel = document.querySelector("#typingPanel");
const toggleTyping = document.querySelector("#toggleTyping");
const openText = document.querySelector("#openText");
const saveText = document.querySelector("#saveText");
const codeTabList = document.querySelector("#codeTabList");
const addCodeTab = document.querySelector("#addCodeTab");
const typingArea = document.querySelector("#typingArea");
const eraserPreview = document.querySelector("#eraserPreview");
const context = canvas.getContext("2d");

const state = {
  tasks: [
    {
      id: crypto.randomUUID(),
      text: "Sketch the first project map",
      done: false,
      collapsed: false,
      editing: false,
      children: [
        {
          id: crypto.randomUUID(),
          text: "Mark unclear areas",
          done: false,
          collapsed: false,
          editing: false,
          children: [],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      text: "Pick one small thing to finish next",
      done: false,
      collapsed: false,
      editing: false,
      children: [],
    },
  ],
  erasing: false,
  drawing: false,
  lastPoint: null,
  activeCodeTabId: "notes",
  codeTabs: [
    { id: "notes", name: "untitled-1.txt", value: "", dirty: false, fileHandle: null },
    { id: "scratch", name: "scratch.txt", value: "", dirty: false, fileHandle: null },
  ],
};

function countOpenTasks(tasks) {
  return tasks.reduce((count, task) => {
    const children = task.children || [];
    return count + (task.done ? 0 : 1) + countOpenTasks(children);
  }, 0);
}

function removeTask(tasks, id) {
  return tasks
    .filter((task) => task.id !== id)
    .map((task) => ({
      ...task,
      children: removeTask(task.children || [], id),
    }));
}

function removeDone(tasks) {
  return tasks
    .filter((task) => !task.done)
    .map((task) => ({
      ...task,
      children: removeDone(task.children || []),
    }));
}

function findTask(tasks, id) {
  for (const task of tasks) {
    if (task.id === id) {
      return task;
    }

    const match = findTask(task.children || [], id);
    if (match) {
      return match;
    }
  }

  return null;
}

function createTask(text) {
  return {
    id: crypto.randomUUID(),
    text,
    done: false,
    collapsed: false,
    editing: false,
    children: [],
  };
}

function createBlankTask() {
  return {
    ...createTask(""),
    editing: true,
  };
}

function renderTask(task) {
  const item = document.createElement("li");
  item.className = "task-item";

  const row = document.createElement("div");
  row.className = task.done ? "task-row done" : "task-row";

  const addSubtask = document.createElement("button");
  addSubtask.className = "task-action";
  addSubtask.type = "button";
  addSubtask.textContent = "+";
  addSubtask.setAttribute("aria-label", `Add sub-step under ${task.text}`);
  addSubtask.addEventListener("click", () => {
    task.children.push(createBlankTask());
    task.collapsed = false;
    renderTasks();
  });

  const toggle = document.createElement("button");
  const hasChildren = task.children.length > 0;

  if (hasChildren) {
    toggle.className = task.collapsed ? "toggle-subtasks collapsed" : "toggle-subtasks";
    toggle.type = "button";
    toggle.textContent = "v";
    toggle.setAttribute("aria-label", task.collapsed ? `Show sub-steps for ${task.text}` : `Hide sub-steps for ${task.text}`);
    toggle.addEventListener("click", () => {
      task.collapsed = !task.collapsed;
      renderTasks();
    });
  } else {
    toggle.className = "toggle-spacer";
    toggle.setAttribute("aria-hidden", "true");
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.addEventListener("change", () => {
    task.done = checkbox.checked;
    renderTasks();
  });

  const text = task.editing ? document.createElement("input") : document.createElement("span");
  text.className = task.editing ? "inline-task-input" : "task-text";

  if (task.editing) {
    text.type = "text";
    text.value = task.text;
    text.setAttribute("aria-label", "Sub-step name");
    text.addEventListener("input", () => {
      task.text = text.value;
    });
    text.addEventListener("blur", () => {
      if (text.value.trim()) {
        task.text = text.value.trim();
        task.editing = false;
      }

      renderTasks();
    });
    text.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && text.value.trim()) {
        task.text = text.value.trim();
        task.editing = false;
        renderTasks();
      }

      if (event.key === "Escape" && !text.value.trim()) {
        state.tasks = removeTask(state.tasks, task.id);
        renderTasks();
      }
    });
    requestAnimationFrame(() => text.focus());
  } else {
    text.textContent = task.text;
  }

  const remove = document.createElement("button");
  remove.className = "remove-task";
  remove.type = "button";
  remove.textContent = "x";
  remove.setAttribute("aria-label", `Remove ${task.text}`);
  remove.addEventListener("click", () => {
    state.tasks = removeTask(state.tasks, task.id);
    renderTasks();
  });

  row.append(addSubtask, toggle, checkbox, text, remove);
  item.append(row);

  if (hasChildren && !task.collapsed) {
    const subList = document.createElement("ul");
    subList.className = "subtask-list";
    task.children.forEach((child) => subList.append(renderTask(child)));
    item.append(subList);
  }

  return item;
}

function setPanelCollapsed(panel, button, collapsed, name) {
  panel.classList.toggle("collapsed", collapsed);
  button.setAttribute("aria-label", collapsed ? `Expand ${name} area` : `Collapse ${name} area`);
  button.title = collapsed ? `Expand ${name} area` : `Collapse ${name} area`;
  button.classList.toggle("active", !collapsed);

  if (panel.classList.contains("canvas-panel") && !collapsed) {
    scheduleCanvasResize();
  }
}

function setTaskPanelCollapsed(collapsed) {
  taskPanel.classList.toggle("collapsed", collapsed);
  layout.classList.toggle("tasks-collapsed", collapsed);
  toggleTasks.setAttribute("aria-label", collapsed ? "Expand to-do area" : "Collapse to-do area");
  toggleTasks.title = collapsed ? "Expand to-do area" : "Collapse to-do area";
  toggleTasks.classList.toggle("active", !collapsed);
  scheduleCanvasResize();
}

function renderTasks() {
  taskList.innerHTML = "";
  state.tasks.forEach((task) => taskList.append(renderTask(task)));
  taskCount.textContent = countOpenTasks(state.tasks);
}

function activeCodeTab() {
  return state.codeTabs.find((tab) => tab.id === state.activeCodeTabId) || state.codeTabs[0];
}

function renderCodeTabs(syncEditor = false) {
  codeTabList.innerHTML = "";

  state.codeTabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = [
      "code-tab",
      tab.id === state.activeCodeTabId ? "active" : "",
      tab.dirty ? "dirty" : "",
    ].filter(Boolean).join(" ");
    item.setAttribute("role", "presentation");

    const tabButton = document.createElement("button");
    tabButton.className = "code-tab-name";
    tabButton.type = "button";
    tabButton.setAttribute("role", "tab");
    tabButton.setAttribute("aria-selected", tab.id === state.activeCodeTabId ? "true" : "false");
    tabButton.title = tab.dirty ? `${tab.name} - unsaved` : tab.name;
    tabButton.addEventListener("click", () => {
      activeCodeTab().value = typingArea.value;
      state.activeCodeTabId = tab.id;
      renderCodeTabs();
      typingArea.value = tab.value;
      typingArea.focus();
    });

    const dot = document.createElement("span");
    dot.className = "dirty-dot";
    dot.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "code-tab-title";
    name.textContent = tab.name;

    const close = document.createElement("button");
    close.className = "code-tab-close";
    close.type = "button";
    close.textContent = "x";
    close.setAttribute("aria-label", `Close ${tab.name}`);
    close.addEventListener("click", () => closeCodeTab(tab.id));

    tabButton.append(dot, name);
    item.append(tabButton, close);
    codeTabList.append(item);
  });

  if (syncEditor) {
    typingArea.value = activeCodeTab().value;
  }
}

function closeCodeTab(id) {
  if (state.codeTabs.length === 1) {
    state.codeTabs[0] = createCodeTab(1);
    state.activeCodeTabId = state.codeTabs[0].id;
    renderCodeTabs(true);
    return;
  }

  const index = state.codeTabs.findIndex((tab) => tab.id === id);
  state.codeTabs = state.codeTabs.filter((tab) => tab.id !== id);

  if (state.activeCodeTabId === id) {
    const nextTab = state.codeTabs[Math.max(0, index - 1)];
    state.activeCodeTabId = nextTab.id;
  }

  renderCodeTabs(true);
}

function createCodeTab(number, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: `untitled-${number}.txt`,
    value: "",
    dirty: false,
    fileHandle: null,
    ...overrides,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveActiveText() {
  const tab = activeCodeTab();
  tab.value = typingArea.value;

  if ("showSaveFilePicker" in window) {
    if (!tab.fileHandle) {
      tab.fileHandle = await window.showSaveFilePicker({
        suggestedName: tab.name.endsWith(".txt") ? tab.name : `${tab.name}.txt`,
        types: [
          {
            description: "Text files",
            accept: { "text/plain": [".txt"] },
          },
        ],
      });
      tab.name = tab.fileHandle.name;
    }

    const writable = await tab.fileHandle.createWritable();
    await writable.write(tab.value);
    await writable.close();
    tab.dirty = false;
    renderCodeTabs();
    return;
  }

  const safeName = tab.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "") || "notes.txt";
  downloadBlob(new Blob([tab.value], { type: "text/plain" }), safeName.endsWith(".txt") ? safeName : `${safeName}.txt`);
  tab.dirty = false;
  renderCodeTabs();
}

async function openTextFile() {
  if (!("showOpenFilePicker" in window)) {
    const tab = createCodeTab(state.codeTabs.length + 1);
    activeCodeTab().value = typingArea.value;
    state.codeTabs.push(tab);
    state.activeCodeTabId = tab.id;
    renderCodeTabs();
    return;
  }

  const [fileHandle] = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: "Text files",
        accept: { "text/plain": [".txt", ".js", ".css", ".html", ".md"] },
      },
    ],
  });
  const file = await fileHandle.getFile();
  const value = await file.text();
  const tab = createCodeTab(state.codeTabs.length + 1, {
    name: file.name,
    value,
    dirty: false,
    fileHandle,
  });

  activeCodeTab().value = typingArea.value;
  state.codeTabs.push(tab);
  state.activeCodeTabId = tab.id;
  renderCodeTabs();
  typingArea.focus();
}

function saveDrawingImage() {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, "project-sketch.png");
    }
  }, "image/png");
}

function scheduleCanvasResize() {
  requestAnimationFrame(resizeCanvas);
  window.setTimeout(resizeCanvas, 180);
}

function resizeCanvas() {
  if (canvasPanel.classList.contains("collapsed")) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }

  const image = context.getImageData(0, 0, canvas.width || 1, canvas.height || 1);
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (image.width > 1 && image.height > 1) {
    const saved = document.createElement("canvas");
    saved.width = image.width;
    saved.height = image.height;
    saved.getContext("2d").putImageData(image, 0, 0);
    context.drawImage(saved, 0, 0, rect.width, rect.height);
  }
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function updateEraserPreview(point) {
  const size = Number(brushSize.value);
  eraserPreview.style.width = `${size}px`;
  eraserPreview.style.height = `${size}px`;
  eraserPreview.style.left = `${point.x}px`;
  eraserPreview.style.top = `${point.y}px`;
  eraserPreview.style.display = state.erasing ? "block" : "none";
}

function hideEraserPreview() {
  eraserPreview.style.display = "none";
}

function drawLine(point) {
  if (!state.lastPoint) {
    state.lastPoint = point;
  }

  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Number(brushSize.value);
  context.strokeStyle = state.erasing ? "#fcfefd" : colorPicker.value;
  context.globalCompositeOperation = state.erasing ? "destination-out" : "source-over";
  context.beginPath();
  context.moveTo(state.lastPoint.x, state.lastPoint.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  state.lastPoint = point;
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = taskInput.value.trim();

  if (!text) {
    return;
  }

  state.tasks.unshift(createTask(text));
  taskInput.value = "";
  renderTasks();
});

clearDone.addEventListener("click", () => {
  state.tasks = removeDone(state.tasks);
  renderTasks();
});

eraseMode.addEventListener("click", () => {
  state.erasing = !state.erasing;
  eraseMode.classList.toggle("active", state.erasing);

  if (!state.erasing) {
    hideEraserPreview();
  }
});

clearCanvas.addEventListener("click", () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
});

saveCanvas.addEventListener("click", saveDrawingImage);

toggleCanvas.addEventListener("click", () => {
  setPanelCollapsed(canvasPanel, toggleCanvas, !canvasPanel.classList.contains("collapsed"), "drawing");
});

toggleTyping.addEventListener("click", () => {
  setPanelCollapsed(typingPanel, toggleTyping, !typingPanel.classList.contains("collapsed"), "typing");
});

toggleTasks.addEventListener("click", () => {
  setTaskPanelCollapsed(!taskPanel.classList.contains("collapsed"));
});

typingArea.addEventListener("input", () => {
  const tab = activeCodeTab();
  tab.value = typingArea.value;
  tab.dirty = true;
  renderCodeTabs();
});

openText.addEventListener("click", () => {
  openTextFile().catch((error) => {
    if (error.name !== "AbortError") {
      console.error(error);
    }
  });
});

saveText.addEventListener("click", () => {
  saveActiveText().catch((error) => {
    if (error.name !== "AbortError") {
      console.error(error);
    }
  });
});

addCodeTab.addEventListener("click", () => {
  const tab = createCodeTab(state.codeTabs.length + 1);
  activeCodeTab().value = typingArea.value;
  state.codeTabs.push(tab);
  state.activeCodeTabId = tab.id;
  renderCodeTabs();
  typingArea.focus();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();

    if (document.activeElement === typingArea || typingPanel.contains(document.activeElement)) {
      saveActiveText().catch((error) => {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      });
      return;
    }

    saveDrawingImage();
  }
});

brushSize.addEventListener("input", () => {
  if (state.erasing && state.lastPoint) {
    updateEraserPreview(state.lastPoint);
  }
});

canvas.addEventListener("pointerdown", (event) => {
  const point = pointerPosition(event);
  state.drawing = true;
  state.lastPoint = point;
  updateEraserPreview(point);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  const point = pointerPosition(event);
  updateEraserPreview(point);

  if (!state.drawing) {
    return;
  }

  drawLine(point);
});

canvas.addEventListener("pointerup", () => {
  state.drawing = false;
  state.lastPoint = null;
});

canvas.addEventListener("pointercancel", () => {
  state.drawing = false;
  state.lastPoint = null;
  hideEraserPreview();
});

canvas.addEventListener("pointerleave", () => {
  if (!state.drawing) {
    hideEraserPreview();
  }
});

window.addEventListener("resize", resizeCanvas);

renderTasks();
renderCodeTabs(true);
toggleTasks.classList.add("active");
toggleCanvas.classList.add("active");
toggleTyping.classList.add("active");
requestAnimationFrame(resizeCanvas);
