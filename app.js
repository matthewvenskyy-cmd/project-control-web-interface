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
const toggleCanvas = document.querySelector("#toggleCanvas");
const canvasPanel = document.querySelector("#canvasPanel");
const typingPanel = document.querySelector("#typingPanel");
const toggleTyping = document.querySelector("#toggleTyping");
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

  if (panel.classList.contains("canvas-panel") && !collapsed) {
    requestAnimationFrame(resizeCanvas);
  }
}

function setTaskPanelCollapsed(collapsed) {
  taskPanel.classList.toggle("collapsed", collapsed);
  layout.classList.toggle("tasks-collapsed", collapsed);
  toggleTasks.setAttribute("aria-label", collapsed ? "Expand to-do area" : "Collapse to-do area");
  toggleTasks.title = collapsed ? "Expand to-do area" : "Collapse to-do area";
}

function renderTasks() {
  taskList.innerHTML = "";
  state.tasks.forEach((task) => taskList.append(renderTask(task)));
  taskCount.textContent = countOpenTasks(state.tasks);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
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

toggleCanvas.addEventListener("click", () => {
  setPanelCollapsed(canvasPanel, toggleCanvas, !canvasPanel.classList.contains("collapsed"), "drawing");
});

toggleTyping.addEventListener("click", () => {
  setPanelCollapsed(typingPanel, toggleTyping, !typingPanel.classList.contains("collapsed"), "typing");
});

toggleTasks.addEventListener("click", () => {
  setTaskPanelCollapsed(!taskPanel.classList.contains("collapsed"));
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
requestAnimationFrame(resizeCanvas);
