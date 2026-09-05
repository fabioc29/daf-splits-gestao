export async function captureReport() {
  const panel = document.querySelector<HTMLElement>('main');
  if (!panel) return;
  await document.fonts.ready;
  const {toPng} = await import('html-to-image');
  const url = await toPng(panel, {
    backgroundColor: '#0c1421', pixelRatio: 1.5,
    width: panel.scrollWidth, height: panel.scrollHeight,
    style: {margin: '0', width: `${panel.scrollWidth}px`, height: `${panel.scrollHeight}px`},
    filter: node => !(node instanceof HTMLElement && (node.classList.contains('headerActions') || node.classList.contains('tableActions'))),
  });
  const link = document.createElement('a');
  link.download = `DAF-relatorio-${new Date().toISOString().slice(0,10)}.png`;
  link.href = url;
  link.click();
}
