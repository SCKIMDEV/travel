/*
 * 사진 서버 연결 문제 알림 — 상단 바 오른쪽의 붉은 "!" 아이콘.
 * 마우스를 올리거나(키보드 포커스) 누르면 안내가 펼쳐진다. 화면 본문에는 안내를 넣지 않는다.
 * 홈(index.html)과 여행 페이지(trip.html)가 함께 쓴다: NetAlert.show(제목, 본문)
 */
const NetAlert = (() => {
  'use strict';
  let root = null;

  function build(title, body) {
    const nav = document.querySelector('.nav');
    if (!nav) return null;
    const el = document.createElement('div');
    el.className = 'net-alert';
    el.innerHTML = `
      <button type="button" class="net-alert-btn" aria-expanded="false" aria-controls="net-alert-msg" aria-describedby="net-alert-msg">
        <span class="net-alert-dot" aria-hidden="true">!</span><span class="sr-only">연결 문제</span>
      </button>
      <div class="net-alert-msg" id="net-alert-msg" role="note">
        <p class="net-alert-title"></p>
        <p class="net-alert-body"></p>
      </div>`;
    el.querySelector('.net-alert-title').textContent = title;
    el.querySelector('.net-alert-body').textContent = body;
    nav.appendChild(el);

    const btn = el.querySelector('.net-alert-btn');
    const set = open => { el.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', e => { e.stopPropagation(); set(!el.classList.contains('is-open')); });   // 터치: 눌러서 열고 닫기
    document.addEventListener('click', e => { if (!el.contains(e.target)) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('is-open')) { set(false); btn.focus(); } });
    return el;
  }

  return {
    show(title, body) {
      if (!root) root = build(title, body);
      else {
        root.querySelector('.net-alert-title').textContent = title;
        root.querySelector('.net-alert-body').textContent = body;
      }
    },
    // 사진 서버에 닿지 못했을 때. Tailscale 이 켜진 기기에서는 서버 주소가 사설 주소로 풀려
    // 브라우저(Chrome·Edge)가 '로컬 네트워크 액세스' 권한으로 막는다. 권한 상태에 맞춰 안내한다.
    async showPhotoServer() {
      const SETTING = "주소창 왼쪽 아이콘 → '이 사이트에 대한 권한' → '로컬 네트워크 액세스'를 허용으로 바꾸고 새로고침하세요.";
      let state = '';
      try { state = (await navigator.permissions.query({ name: 'local-network-access' })).state; } catch { state = ''; }
      if (state === 'denied') {
        this.show('브라우저가 사진 서버 연결을 막고 있어요', `Tailscale 이 켜진 기기에서 생기는 일이에요. ${SETTING}`);
      } else if (state === 'prompt') {
        this.show('사진 서버 연결을 허용해 주세요', `주소창에 뜬 '로컬 네트워크 액세스' 창에서 허용을 누르고 새로고침하세요. 창이 보이지 않으면 ${SETTING}`);
      } else if (state === 'granted') {
        this.show('사진을 불러오지 못했어요', '사진 서버에 연결하지 못했어요. 서버 PC 와 Tailscale 이 켜져 있는지 확인한 뒤 새로고침하세요.');
      } else {   // 권한 정보를 알려주지 않는 브라우저
        this.show('사진을 불러오지 못했어요', `Tailscale 이 켜진 기기라면 ${SETTING} 그래도 안 되면 서버 PC 가 켜져 있는지 확인하세요.`);
      }
    }
  };
})();
