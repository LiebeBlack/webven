/**
 * js/ui.js — Comportamiento de interfaz
 *
 * Todo lo que no es datos ni gráficos: pantalla de arranque, barra de progreso
 * de lectura, revelado de secciones, copiado de citas, avisos efímeros y la
 * paleta de comandos. Cada función falla en silencio si su elemento no existe,
 * porque la interfaz debe poder montarse por partes.
 */

import { CLASSES, SECTIONS } from "./config.js";
import { num } from "./format.js";

/* ------------------------------------------------------------------ boot --- */

export function setNoJsFlag() {
  document.documentElement.classList.remove(CLASSES.noJs);
}

export function hideBoot() {
  const boot = document.getElementById("boot-screen");
  if (!boot) return;
  boot.classList.add("is-done");
  window.setTimeout(() => {
    boot.setAttribute("hidden", "");
  }, 700);
}

export function appendBootLine(label, detail, status = "ok") {
  const log = document.getElementById("boot-log");
  if (!log) return;
  const line = document.createElement("div");
  line.className = "boot__line";
  line.innerHTML = `<span></span><span class="${status}"></span>`;
  line.firstChild.textContent = label;
  line.lastChild.textContent = detail;
  log.appendChild(line);
}

/* -------------------------------------------------------------- progreso --- */

export function initProgressBar() {
  const bar = document.getElementById("progress-bar");
  if (!bar) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.width = `${(ratio * 100).toFixed(2)}%`;
    bar.parentElement.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  };
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
  window.addEventListener("resize", update, { passive: true });
  update();
}

/* ---------------------------------------------------------------- revelado --- */

/** Revela elementos al entrar en pantalla. Sin observador, todo queda visible. */
export function initRevealObserver() {
  const targets = document.querySelectorAll(".timeline__item, .panel");
  if (!("IntersectionObserver" in window)) {
    targets.forEach((node) => node.classList.add(CLASSES.visible));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(CLASSES.visible);
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  targets.forEach((node) => {
    if (node.classList.contains("timeline__item")) observer.observe(node);
    else node.classList.add(CLASSES.visible);
  });
}

/** Anima las cifras grandes desde cero al aparecer. Respeta movimiento reducido. */
export function initCountUp() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;
  const values = document.querySelectorAll(".value--lg");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const node = entry.target;
        const raw = node.textContent.trim();
        const match = /^([^\d]*)([\d.,]+)(.*)$/.exec(raw);
        if (!match) return;
        const [, prefix, numberText, suffix] = match;
        const target = Number(numberText.replace(/\./g, "").replace(",", "."));
        if (!Number.isFinite(target) || target === 0) return;
        const decimals = /,\d+$/.test(numberText) ? numberText.split(",")[1].length : 0;
        const started = performance.now();
        const duration = 720;
        const step = (now) => {
          const progress = Math.min(1, (now - started) / duration);
          const eased = 1 - (1 - progress) ** 3;
          node.textContent = `${prefix}${num(target * eased, decimals)}${suffix}`;
          if (progress < 1) requestAnimationFrame(step);
          else node.textContent = raw;
        };
        requestAnimationFrame(step);
      });
    },
    { threshold: 0.4 }
  );
  values.forEach((node) => observer.observe(node));
}

/* ---------------------------------------------------------------- navegación --- */

export function initNavActive() {
  const links = [...document.querySelectorAll(".nav__link")];
  if (!links.length || !("IntersectionObserver" in window)) return;
  const map = new Map();
  links.forEach((link) => {
    const id = link.getAttribute("href")?.replace("#", "");
    const section = id ? document.getElementById(id) : null;
    if (section) map.set(section, link);
  });
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove(CLASSES.active));
        const link = map.get(entry.target);
        if (link) link.classList.add(CLASSES.active);
      });
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );
  map.forEach((_link, section) => observer.observe(section));
}

/* ------------------------------------------------------------------ avisos --- */

export function toast(message, kind = "info", { timeout = 4200 } = {}) {
  const wrap = document.getElementById("toast-wrap");
  if (!wrap) return;
  const node = document.createElement("div");
  node.className = `toast ${kind === "error" ? "toast--error" : kind === "warn" ? "toast--warn" : ""}`;
  node.setAttribute("role", kind === "error" ? "alert" : "status");
  node.textContent = message;
  wrap.appendChild(node);
  window.setTimeout(() => {
    node.classList.add("is-leaving");
    window.setTimeout(() => node.remove(), 320);
  }, timeout);
}

/** Anuncia un cambio para lectores de pantalla sin mostrar aviso visual. */
export function announce(message) {
  const region = document.getElementById("live-region");
  if (!region) return;
  region.textContent = message;
}

export function initAnnouncements() {
  window.addEventListener("observatorio:announce", (event) => announce(event.detail));
}

/* ------------------------------------------------------------------ copiar --- */

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error("Portapapeles no disponible");
  } catch {
    // Respaldo para contextos sin permiso de portapapeles.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function initCitationCopy() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cite]");
    if (!button) return;
    event.stopPropagation();
    const ok = await copyText(button.dataset.cite ?? "");
    toast(ok ? "Cita copiada al portapapeles." : "No se pudo copiar la cita.", ok ? "info" : "warn");
    if (ok) {
      const original = button.textContent;
      button.textContent = "copiada";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1600);
    }
  });
}

/* ---------------------------------------------------------------- descargas --- */

export function downloadBlob(filename, content, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------- paleta de comandos --- */

export function initCommandPalette(data) {
  const palette = document.getElementById("command-palette");
  const input = document.getElementById("palette-input");
  const list = document.getElementById("palette-list");
  if (!palette || !input || !list) return;

  const commands = [
    ...SECTIONS.map((section) => ({
      label: `Ir a ${section.label}`,
      kind: "sección",
      run: () => {
        document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    })),
    ...(data.arbitration_cases ?? []).map((record) => ({
      label: `Abrir laudo: ${record.claimant}`,
      kind: "laudo",
      run: () => openById(`award-${record.id}`),
    })),
    ...(data.recovery_mechanisms ?? []).map((mechanism) => ({
      label: `Abrir mecanismo: ${mechanism.name}`,
      kind: "mecanismo",
      run: () => openById(`mecanismo-${mechanism.id}`),
    })),
    ...(data.kpis ?? []).map((kpi) => ({
      label: `Abrir indicador: ${kpi.label}`,
      kind: "indicador",
      run: () => openById(`kpi-${kpi.id}`),
    })),
    {
      label: "Expandir todas las tarjetas",
      kind: "acción",
      run: () => document.dispatchEvent(new CustomEvent("observatorio:expand-all")),
    },
    {
      label: "Contraer todas las tarjetas",
      kind: "acción",
      run: () => document.dispatchEvent(new CustomEvent("observatorio:collapse-all")),
    },
    {
      label: "Abrir la auditoría del dataset",
      kind: "acción",
      run: () => window.open("./tests/validate.html", "_blank", "noopener"),
    },
    {
      label: "Imprimir el dossier ejecutivo",
      kind: "acción",
      run: () => window.print(),
    },
  ];

  let index = 0;

  function openById(id) {
    const node = document.getElementById(id);
    if (!node) {
      toast(`No se encontró el registro ${id}.`, "warn");
      return;
    }
    window.location.hash = `#${id}`;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function render(filtered) {
    list.innerHTML = filtered
      .slice(0, 40)
      .map(
        (command, i) =>
          `<li class="palette__item" role="option" aria-selected="${i === index}" data-command-index="${i}">
            <span>${command.label}</span><span class="palette__kind">${command.kind}</span>
          </li>`
      )
      .join("");
  }

  function filtered() {
    const query = input.value.trim().toLowerCase();
    if (!query) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(query));
  }

  function show() {
    palette.hidden = false;
    input.value = "";
    index = 0;
    render(commands);
    input.focus();
  }

  function hide() {
    palette.hidden = true;
  }

  function execute(command) {
    if (!command) return;
    hide();
    command.run();
  }

  document.addEventListener("keydown", (event) => {
    const isPaletteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
    if (isPaletteShortcut) {
      event.preventDefault();
      palette.hidden ? show() : hide();
      return;
    }
    if (palette.hidden) return;
    const current = filtered();
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      index = Math.min(index + 1, Math.min(current.length, 40) - 1);
      render(current);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      index = Math.max(index - 1, 0);
      render(current);
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(current[index]);
    }
  });

  input.addEventListener("input", () => {
    index = 0;
    render(filtered());
  });

  list.addEventListener("click", (event) => {
    const item = event.target.closest("[data-command-index]");
    if (!item) return;
    execute(filtered()[Number(item.dataset.commandIndex)]);
  });

  palette.addEventListener("click", (event) => {
    if (event.target === palette) hide();
  });

  const trigger = document.querySelector("[data-open-palette]");
  if (trigger) trigger.addEventListener("click", show);
}

/* ------------------------------------------------------------------ impresión --- */

/** Antes de imprimir se expande todo: en papel no hay clics. */
export function initPrintExpansion() {
  window.addEventListener("beforeprint", () => {
    document.dispatchEvent(new CustomEvent("observatorio:expand-all"));
  });
}

/* -------------------------------------------------------------- utilidades --- */

/** Marca de tiempo legible para los encabezados de sección. */
export function nowLabel() {
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
}

/** Resumen de conteos para el encabezado de la sección de fuentes. */
export function countLabel(node, label) {
  if (!node) return;
  node.textContent = label;
}
