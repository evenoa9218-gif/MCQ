/**
 * MCQ 서비스워커.
 *
 * 예전에는 모든 요청을 캐시 우선(cache-first)으로 처리했다. 그러면 HTML을
 * 새로 배포해도 캐시에 든 옛 화면이 계속 나온다 — CACHE 이름을 올리지 않는 한
 * 영영 갱신되지 않는다. 실제로 과목선택 화면을 없앤 뒤에도 방문자에게는
 * 옛 화면이 그대로 보였다.
 *
 * 그래서 **문서(navigate) 요청은 네트워크 우선**으로 바꿨다. 오프라인일 때만
 * 캐시가 답한다. 나머지 자산은 캐시 우선을 유지한다 — 잘 바뀌지 않기 때문이다.
 */
const CACHE = 'ox-quiz-v29';  // v29: 민사 선택형 공식 정답 15문항 바로잡음(법무부 공고 원문 재대조 — 변01~12 문2~5) · 민사 모17-1 17문 추가 · OX 정오 오류 41지문 정정(형사 13·민사 28, 해설 보완) · 5지선다 ⚠ 표시 정리(판례 변경 5곳은 바뀐 판례 명시, 뒤집어 쓴 OX 지문 오탐 제거) · v28: 형사·민사에도 「푸는 방식」 전환 — OX 지문이 실린 기출을 5지선다로(형법총론 379 · 형법각론 479 · 형사소송법 542 · 민법총칙 163 · 물권법 239 · 채권총론 224 · 채권각론 162 · 민사소송법 401문, 원본 문제지 + 공식 정답) · v27: 공법 헌법·행정법에 「푸는 방식」 전환 — 같은 문항을 5지선다로(헌법 600 · 행정법총론 527 · 행정법각론 74문, 선지·보기별 해설) · OX 출처 둘 바로잡음(헌법 M201 25.06모 · 행정법 M027 24.06모) · v26: 공법 행정법 OX에 법전협 모의 21~25년 301문 더함(총론 2,466지문 · 각론 349지문, 새 주제 8개) · v25: 공법 행정법각론 OX 170지문(변시 12~26회, 행정조직·지방자치·공무원·공물·공용부담) 열림 · v24: 공법 행정법총론 OX 1,229지문(변시 12~26회, 통론~행정구제법) 열림 · 헌법 서두에 섞여 있던 「원본 정답」 메모를 해설로 옮김(답이 미리 보이던 61문) · v23: 헌법 OX — 빠져 있던 13년 변시 재산권 문항(5지문) 채움 · v22: 공법 헌법 OX 2,908지문(변시 12~26회·법전협 모의 21~25년) 열림 · v21: 폰 문제 화면 촘촘히(문제+선지 한 화면) · 선지 표시 아이콘 다듬음 · v20: 선지별 헷갈림 단추를 번호 밑으로(지문 폭 그대로) · v19: 5지선다 선지·보기별 헷갈림 표시 · v18: 본문 글 띄어쓰기를 고르게(왼쪽 정렬), 폰에서는 글자 단위 줄바꿈으로 오른쪽 빈자리 없앰 · v17: 선지·보기·해설 양쪽 맞춤(v18에서 거둠) · v13: 26년 8월 모의 민사·공법 5지선다(스캔본) 추가
const ASSETS = [
  '/MCQ/',
  '/MCQ/index.html',
  '/MCQ/criminal.html',
  '/MCQ/public-law.html',
  '/MCQ/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.includes('.mp4')) return;      // 배경영상은 캐시하지 않는다(용량)

  // 문서는 네트워크 우선 — 배포한 화면이 바로 보여야 한다.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('/MCQ/')))
    );
    return;
  }

  // 문항 데이터는 캐시를 먼저 내주되 뒤에서 새 판을 받아둔다.
  // 캐시 우선만 쓰면 문제를 고쳐 배포해도 캐시 이름을 올리기 전까지 옛 문제가 남고,
  // 네트워크 우선으로 하면 1MB짜리를 매번 기다려야 한다. 그 사이를 택했다.
  if (req.url.includes('/MCQ/data/')) {
    e.respondWith(
      caches.match(req).then(cached => {
        // no-cache: 브라우저 HTTP 캐시를 믿지 않고 서버에 바뀌었는지 물어본다(안 바뀌었으면 304 로 끝난다).
        // GitHub Pages 가 max-age=600 을 붙여서, 이게 없으면 배포 뒤 10분 동안 옛 문항이 다시 캐시된다.
        const fresh = fetch(req, { cache: 'no-cache' }).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        });
        return cached || fresh;
      })
    );
    return;
  }

  // 그 밖의 자산은 캐시 우선.
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match('/MCQ/'));
    })
  );
});
