import { html } from 'lit';

let isPatched = false;

/**
 * Patches legacy span elements with .material-symbols-outlined or .material-icons to display M3 SVG
 */
export function patchSpanIcons(root = document) {
  if (typeof document === 'undefined') return;
  const elements = root.querySelectorAll ? root.querySelectorAll('.material-symbols-outlined, .material-icons') : [];
  for (const el of elements) {
    if (el._m3SvgHandled) continue;
    const name = el.textContent?.trim();
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) continue;
    el._m3SvgHandled = true;
    const iconUrl = `./img/M3icons/${name}.svg`;
    el.textContent = '';
    const glyph = document.createElement('span');
    glyph.className = 'm3-icon-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.style.cssText = `display:inline-block;width:1em;height:1em;vertical-align:middle;background-color:currentColor;-webkit-mask:url('${iconUrl}') no-repeat center / contain;mask:url('${iconUrl}') no-repeat center / contain;pointer-events:none;`;
    el.appendChild(glyph);
  }
}

/**
 * Replaces font-based icon glyphs in md-icon with local M3 SVG assets from img/M3icons/
 */
export function initM3SvgIcons() {
  if (isPatched) return;

  function patchMdIcon(MdIcon) {
    if (!MdIcon || MdIcon._m3SvgPatched) return;
    MdIcon._m3SvgPatched = true;

    const originalRender = MdIcon.prototype.render;

    MdIcon.prototype.render = function () {
      if (!this.name) {
        return originalRender ? originalRender.call(this) : html`<slot></slot>`;
      }

      const iconUrl = `./img/M3icons/${this.name}.svg`;

      return html`<slot><span class="m3-icon-glyph" aria-hidden="true" style="display:inline-block;width:100%;height:100%;background-color:currentColor;-webkit-mask:url('${iconUrl}') no-repeat center / contain;mask:url('${iconUrl}') no-repeat center / contain;pointer-events:none;"></span></slot>`;
    };

    isPatched = true;
  }

  const existing = customElements.get('md-icon');
  if (existing) {
    patchMdIcon(existing);
  } else if (typeof customElements !== 'undefined' && customElements.whenDefined) {
    customElements.whenDefined('md-icon').then(() => {
      patchMdIcon(customElements.get('md-icon'));
    });
  }

  // Setup observer for any legacy .material-symbols-outlined span tags
  if (typeof document !== 'undefined') {
    const runPatch = () => {
      patchSpanIcons(document);
      if (document.body && !document.body._m3SpanObserver) {
        document.body._m3SpanObserver = true;
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === 'childList' && m.addedNodes.length > 0) {
              for (const node of m.addedNodes) {
                if (node.nodeType === 1) { // ELEMENT_NODE
                  if (node.classList?.contains('material-symbols-outlined') || node.classList?.contains('material-icons')) {
                    patchSpanIcons(node.parentElement || document);
                  } else {
                    patchSpanIcons(node);
                  }
                }
              }
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runPatch);
    } else {
      runPatch();
    }
  }
}

// Auto-initialize upon import
initM3SvgIcons();
