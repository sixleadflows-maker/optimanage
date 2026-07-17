// Sets the physical page size for this one print job via a temporary <style>
// tag (CSS @page can't be scoped by a body class the way normal rules can),
// then cleans it up once the (synchronous) print dialog has been dismissed.
export function printWithPageSize(bodyClass: string, pageSize: string) {
  const style = document.createElement("style");
  style.textContent = `@page { size: ${pageSize}; margin: 0; }`;
  document.head.appendChild(style);
  document.body.classList.add(bodyClass);
  window.print();
  document.body.classList.remove(bodyClass);
  document.head.removeChild(style);
}
