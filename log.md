Run npm run lint

> lint
> biome check js/ tests/

tests/interactions.test.js:241:18 lint/style/useNumberNamespace  FIXABLE  ━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Use Number.parseFloat instead of the equivalent global.
  
    239 │     win.dispatchEvent(ptr("pointermove", { x: 2000, y: 2000 })); // try to shrink massively
    240 │ 
  > 241 │     const gotW = parseFloat(win.style.width  || "860");
        │                  ^^^^^^^^^^
    242 │     const gotH = parseFloat(win.style.height || "640");
    243 │     expect(gotW).toBeGreaterThanOrEqual(340);
  
  i ES2015 moved some globals into the Number namespace for consistency.
  
  i Safe fix: Use Number.parseFloat instead.
  
    239 239 │       win.dispatchEvent(ptr("pointermove", { x: 2000, y: 2000 })); // try to shrink massively
    240 240 │   
    241     │ - ····const·gotW·=·parseFloat(win.style.width··||·"860");
        241 │ + ····const·gotW·=·Number.parseFloat(win.style.width··||·"860");
    242 242 │       const gotH = parseFloat(win.style.height || "640");
    243 243 │       expect(gotW).toBeGreaterThanOrEqual(340);
  

tests/interactions.test.js:242:18 lint/style/useNumberNamespace  FIXABLE  ━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Use Number.parseFloat instead of the equivalent global.
  
    241 │     const gotW = parseFloat(win.style.width  || "860");
  > 242 │     const gotH = parseFloat(win.style.height || "640");
        │                  ^^^^^^^^^^
    243 │     expect(gotW).toBeGreaterThanOrEqual(340);
    244 │     expect(gotH).toBeGreaterThanOrEqual(220);
  
  i ES2015 moved some globals into the Number namespace for consistency.
  
  i Safe fix: Use Number.parseFloat instead.
  
    240 240 │   
    241 241 │       const gotW = parseFloat(win.style.width  || "860");
    242     │ - ····const·gotH·=·parseFloat(win.style.height·||·"640");
        242 │ + ····const·gotH·=·Number.parseFloat(win.style.height·||·"640");
    243 243 │       expect(gotW).toBeGreaterThanOrEqual(340);
     51  54 │   
    ······· │ 
     70  73 │   
     71  74 │     if (w && h) {
     72     │ - ····win.getBoundingClientRect·=·()·=>
     73     │ - ······({·left:·0,·top:·0,·right:·w,·bottom:·h,·width:·w,·height:·h·});
         75 │ + ····win.getBoundingClientRect·=·()·=>·({
         76 │ + ······left:·0,
         77 │ + ······top:·0,
         78 │ + ······right:·w,
         79 │ + ······bottom:·h,
         80 │ + ······width:·w,
         81 │ + ······height:·h,
         82 │ + ····});
     74  83 │     }
     75  84 │   
    ······· │ 
     81  90 │   function ptr(type, { x = 0, y = 0, id = 1 } = {}) {
     82  91 │     const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: id };
     83     │ - ··try···{·return·new·PointerEvent(type,·init);·}
     84     │ - ··catch·{·const·e·=·new·MouseEvent(type,·init);
     85     │ - ··········Object.defineProperty(e,·"pointerId",·{·value:·id·});
     86     │ - ··········return·e;·}
         92 │ + ··try·{
         93 │ + ····return·new·PointerEvent(type,·init);
         94 │ + ··}·catch·{
         95 │ + ····const·e·=·new·MouseEvent(type,·init);
         96 │ + ····Object.defineProperty(e,·"pointerId",·{·value:·id·});
         97 │ + ····return·e;
         98 │ + ··}
     87  99 │   }
     88 100 │   
    ······· │ 
     90 102 │   describe("Draggable — resize handles", () => {
     91 103 │     let win;
     92     │ - ··beforeEach(()·=>·{·win·=·makeWindow();·App.Draggable.init(win);·});
        104 │ + ··beforeEach(()·=>·{
        105 │ + ····win·=·makeWindow();
        106 │ + ····App.Draggable.init(win);
        107 │ + ··});
     93 108 │     afterEach(() => win.remove());
     94 109 │   
    ······· │ 
    106 121 │   
    107 122 │     it("every handle has the base resize-handle class", () => {
    108     │ - ····win.querySelectorAll("[data-edge]").forEach((h)·=>
    109     │ - ······expect(h.classList.contains("resize-handle")).toBe(true)
    110     │ - ····);
        123 │ + ····win
        124 │ + ······.querySelectorAll("[data-edge]")
        125 │ + ······.forEach((h)·=>·expect(h.classList.contains("resize-handle")).toBe(true));
    111 126 │     });
    112 127 │   });
    ······· │ 
    141 156 │       const tb = win.querySelector(".titlebar");
    142 157 │       tb.dispatchEvent(ptr("pointerdown", { x: 100, y: 80 }));
    143     │ - ····tb.dispatchEvent(ptr("pointerup",···{·x:·100,·y:·80·}));
        158 │ + ····tb.dispatchEvent(ptr("pointerup",·{·x:·100,·y:·80·}));
    144 159 │       expect(win.classList.contains("dragging")).toBe(false);
    145 160 │     });
    146 161 │   
    147 162 │     it("does NOT drag when clicking a .dot inside the titlebar", () => {
    148     │ - ····const·tb··=·win.querySelector(".titlebar");
        163 │ + ····const·tb·=·win.querySelector(".titlebar");
    149 164 │       const dot = document.createElement("span");
    150 165 │       dot.className = "dot";
    ······· │ 
    153 168 │       // pointerdown on the dot — the handler returns early
    154 169 │       dot.dispatchEvent(ptr("pointerdown", { x: 100, y: 80 }));
    155     │ - ····tb.dispatchEvent(ptr("pointermove",··{·x:·200,·y:·160·}));
        170 │ + ····tb.dispatchEvent(ptr("pointermove",·{·x:·200,·y:·160·}));
    156 171 │   
    157 172 │       // window should NOT have been dragged
    ······· │ 
    161 176 │   
    162 177 │     it("does NOT drag when clicking a .resize-handle (resize takes priority)", () => {
    163     │ - ····const·tb·····=·win.querySelector(".titlebar");
        178 │ + ····const·tb·=·win.querySelector(".titlebar");
    164 179 │       const handle = win.querySelector(".resize-n");
    165 180 │   
    166 181 │       handle.dispatchEvent(ptr("pointerdown", { x: 100, y: 0 }));
    167     │ - ····tb.dispatchEvent(ptr("pointermove",·····{·x:·200,·y:·50·}));
        182 │ + ····tb.dispatchEvent(ptr("pointermove",·{·x:·200,·y:·50·}));
    168 183 │   
    169 184 │       // Drag listener ignores events from resize handles
    ······· │ 
    211 226 │     it("pointermove on .resize-se grows width and height", () => {
    212 227 │       const se = win.querySelector(".resize-se");
    213     │ - ····se.dispatchEvent(ptr("pointerdown",·{·x:·860,·y:·640·}));··//·startW=860,·startH=640
        228 │ + ····se.dispatchEvent(ptr("pointerdown",·{·x:·860,·y:·640·}));·//·startW=860,·startH=640
    214 229 │       win.dispatchEvent(ptr("pointermove", { x: 910, y: 680 })); // dx=+50, dy=+40
    215 230 │   
    216     │ - ····expect(win.style.width).toBe("910px");···//·860·+·50
    217     │ - ····expect(win.style.height).toBe("680px");··//·640·+·40
        231 │ + ····expect(win.style.width).toBe("910px");·//·860·+·50
        232 │ + ····expect(win.style.height).toBe("680px");·//·640·+·40
    218 233 │     });
    219 234 │   
    220 235 │     it("pointermove on .resize-nw shrinks width and height from top-left", () => {
    221 236 │       const nw = win.querySelector(".resize-nw");
    222     │ - ····nw.dispatchEvent(ptr("pointerdown",·{·x:·0,·y:·0·}));······//·startW=860,·startH=640
    223     │ - ····win.dispatchEvent(ptr("pointermove",·{·x:·50,·y:·40·}));···//·dx=+50,·dy=+40·(shrinking·nw)
        237 │ + ····nw.dispatchEvent(ptr("pointerdown",·{·x:·0,·y:·0·}));·//·startW=860,·startH=640
        238 │ + ····win.dispatchEvent(ptr("pointermove",·{·x:·50,·y:·40·}));·//·dx=+50,·dy=+40·(shrinking·nw)
    224 239 │   
    225     │ - ····expect(win.style.width).toBe("810px");···//·860·-·50
    226     │ - ····expect(win.style.height).toBe("600px");··//·640·-·40
        240 │ + ····expect(win.style.width).toBe("810px");·//·860·-·50
        241 │ + ····expect(win.style.height).toBe("600px");·//·640·-·40
    227 242 │     });
    228 243 │   
    ······· │ 
    230 245 │       const se = win.querySelector(".resize-se");
    231 246 │       se.dispatchEvent(ptr("pointerdown", { x: 860, y: 640 }));
    232     │ - ····win.dispatchEvent(ptr("pointerup",··{·x:·860,·y:·640·}));
        247 │ + ····win.dispatchEvent(ptr("pointerup",·{·x:·860,·y:·640·}));
    233 248 │       expect(win.classList.contains("resizing")).toBe(false);
    234 249 │     });
    ······· │ 
    236 251 │     it("resize does not shrink below MIN_W=340 / MIN_H=220", () => {
    237 252 │       const nw = win.querySelector(".resize-nw");
    238     │ - ····nw.dispatchEvent(ptr("pointerdown",·{·x:·0,····y:·0····}));
        253 │ + ····nw.dispatchEvent(ptr("pointerdown",·{·x:·0,·y:·0·}));
    239 254 │       win.dispatchEvent(ptr("pointermove", { x: 2000, y: 2000 })); // try to shrink massively
    240 255 │   
    241     │ - ····const·gotW·=·parseFloat(win.style.width··||·"860");
        256 │ + ····const·gotW·=·parseFloat(win.style.width·||·"860");
    242 257 │       const gotH = parseFloat(win.style.height || "640");
    243 258 │       expect(gotW).toBeGreaterThanOrEqual(340);
    ······· │ 
    277 292 │       document.body.appendChild(el);
    278 293 │   
    279     │ - ····el.dispatchEvent(new·MouseEvent("contextmenu",·{
    280     │ - ······bubbles:·true,·cancelable:·true,·clientX:·400,·clientY:·300,
    281     │ - ····}));
  73 more lines truncated
  

check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Some errors were emitted while running checks.
  

Skipped 1 suggested fixes.
If you wish to apply the suggested (unsafe) fixes, use the command biome check --fix --unsafe

Checked 32 files in 96ms. No fixes applied.
Found 4 errors.