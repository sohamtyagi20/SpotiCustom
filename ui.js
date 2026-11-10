(() => {
  const isPreview = new URLSearchParams(window.location.search).has("preview");

  if (isPreview) {
    document.querySelectorAll('a[href$=".html"]').forEach((link) => {
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin) {
        url.searchParams.set("preview", "1");
        link.href = url.href;
      }
    });
  }

  const menuButton = document.querySelector("[data-menu-button]");
  const menu = document.querySelector("[data-menu]");

  if (!menuButton || !menu) return;

  const setOpen = (isOpen) => {
    menu.hidden = !isOpen;
    menuButton.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  };

  menuButton.addEventListener("click", () => {
    setOpen(menuButton.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
      setOpen(false);
    }
  });
})();
