export default function PrintTaskButton({ onClick }) {
  return (
    <button className="print-task-btn" onClick={onClick} title="Print this task">
      🖨 Print this task
    </button>
  );
}
