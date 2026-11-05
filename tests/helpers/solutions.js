// Reference solutions shared by several test files.
export const RENDER = `// The HTML is ready: #task, #add, #list, #count
const tasks = loadTasks();
const list = $("#list");

function render() {
  list.innerHTML = "";
  tasks.forEach(task => {
    const li = document.createElement("li");
    li.textContent = task.title;
    if (task.done) li.classList.add("done");
    li.onclick = () => { task.done = !task.done; render(); };
    list.appendChild(li);
  });
  const left = tasks.filter(t => !t.done).length;
  $("#count").textContent = left + " left";
}

$("#add").onclick = () => {
  tasks.push({ title: $("#task").value, done: false });
  $("#task").value = "";
  render();
};

render();
`;
