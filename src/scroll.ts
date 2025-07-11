export function scrollToBottom(element: HTMLElement, props?: { force?: boolean }) {
  // scroll to bottom immediately, unless the element is 20px or more from the bottom
  if (!props?.force && element.scrollHeight - element.scrollTop > element.clientHeight + 200) {
    return;
  }

  element.scrollTop = element.scrollHeight;
}
