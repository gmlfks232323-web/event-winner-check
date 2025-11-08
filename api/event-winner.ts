// api/event-winner.ts
export const config = { runtime: 'edge' };

const SHEET_API_URL = process.env.SHEET_API_URL!;
const SHEET_API_SECRET = process.env.SHEET_API_SECRET!;
const COUPON_BLOCK_ID = process.env.COUPON_BLOCK_ID!;
const THANKS_BLOCK_ID = process.env.THANKS_BLOCK_ID!;

function res(template: any) {
  return new Response(JSON.stringify({ version: '2.0', template }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
const t = (s: string) => ({ simpleText: { text: s } });

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await req.json().catch(() => ({}));
  const utter = (body?.userRequest?.utterance || '').trim();

  // 1) "이름 전화번호" 패턴 찾기
  //   예: "홍길동 01012345678" 또는 "홍길동 010-1234-5678"
  const m = utter.match(/([\p{L}가-힣]+)\s+([0-9\-]+)/u);

  // 아직 이름+전화번호를 안 준 상태 → 안내 메시지
  if (!m) {
    return res({
      outputs: [
        t(
          '당첨자 확인을 위해\n' +
          '이름과 전화번호를 아래 예시처럼 입력해주세요.\n\n' +
          '예) 홍길동 01012345678 (이름 + 여백 + 전화번호)'
        )
      ]
    });
  }

  const name = m[1];                   // 홍길동
  const rawPhone = m[2];               // 01012345678 또는 010-1234-5678
  const phone = rawPhone.replace(/[^0-9]/g, ''); // 숫자만 추출

  // 2) 구글 시트(Apps Script) 호출
  const url = new URL(SHEET_API_URL);
  url.searchParams.set('secret', SHEET_API_SECRET);
  url.searchParams.set('name', name);
  url.searchParams.set('phone', phone);
  url.searchParams.set('mark', 'issue');   // 당첨자면 issued_at 기록

  const resp = await fetch(url.toString()).catch(() => null);
  const data = await resp?.json().catch(() => ({} as any));

  // 시트 응답이 이상해도 → 그냥 "이번주 당첨자 아님"으로 처리
  if (!data?.ok) {
    return res({
      outputs: [{
        basicCard: {
          title: '아쉽지만 이번 주 당첨자에 포함되지 않았어요 😢',
          description: '다음 이벤트에도 꼭 참여해 주세요!',
          buttons: [
            { action: 'block', label: '감사 인사 보기', blockId: THANKS_BLOCK_ID }
          ]
        }
      }]
    });
  }

  const winner = !!data.winner;


  // 3) 당첨 / 미당첨 분기
  if (winner) {
    // ✅ 당첨자 → 쿠폰 발급 + 감사 인사 보기
    return res({
      outputs: [{
        basicCard: {
          title: `${name}님 축하합니다 🎉`,
          description: '당첨자로 확인되었습니다!\n아래 버튼을 눌러 쿠폰을 발급받아 주세요.',
          buttons: [
            { action: 'block', label: '쿠폰 발급', blockId: COUPON_BLOCK_ID },
            { action: 'block', label: '감사 인사 보기', blockId: THANKS_BLOCK_ID }
          ]
        }
      }]
    });
  } else {
    // ❌ 미당첨 → 안내 + 감사 인사 보기
    return res({
      outputs: [{
        basicCard: {
          title: `${name}님, 아쉽지만 이번엔 당첨자가 아닙니다 😢`,
          description: '다음 이벤트에도 꼭 참여해주세요!',
          buttons: [
            { action: 'block', label: '감사 인사 보기', blockId: THANKS_BLOCK_ID }
          ]
        }
      }]
    });
  }
}
