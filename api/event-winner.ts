export const config = { runtime: 'edge' };

const SHEET_API_URL = process.env.SHEET_API_URL!;
const SHEET_API_SECRET = process.env.SHEET_API_SECRET!;
const COUPON_BLOCK_ID = process.env.COUPON_BLOCK_ID!;
const FAIL_BLOCK_ID = process.env.FAIL_BLOCK_ID!;
const THANKS_BLOCK_ID = process.env.THANKS_BLOCK_ID!;

function res(template: any) {
  return new Response(JSON.stringify({ version: '2.0', template }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
const t = (s: string) => ({ simpleText: { text: s } });

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const body = await req.json().catch(() => ({}));
  const utter = (body?.userRequest?.utterance || '').trim();

  const context = body?.contexts?.[0]?.params || {};
  const name = context?.name?.value || '';
  const phone = context?.phone?.value || '';

  // ① 이름 요청
  if (!name) {
    return res({
      outputs: [t('이름을 입력해주세요.')],
      quickReplies: [{ label: '예: 홍길동', action: 'message', messageText: '홍길동' }]
    });
  }

  // ② 전화번호 요청
  if (!phone) {
    return res({
      outputs: [t('전화번호를 입력해주세요. (숫자만 입력)')],
      quickReplies: [{ label: '예: 01012345678', action: 'message', messageText: '01012345678' }]
    });
  }

  // ③ 시트 조회 + 발급 기록
  const url = new URL(SHEET_API_URL);
  url.searchParams.set('secret', SHEET_API_SECRET);
  url.searchParams.set('name', name);
  url.searchParams.set('phone', phone);
  url.searchParams.set('mark', 'issue');

  const resp = await fetch(url.toString()).catch(() => null);
  const data = await resp?.json().catch(() => ({}));

  if (!data?.ok) {
    return res({ outputs: [t('시트 확인 중 오류가 발생했습니다. 다시 시도해주세요.')] });
  }

  // ④ 결과 분기
  if (data.winner) {
    return res({
      outputs: [{
        basicCard: {
          title: `${name}님 축하합니다 🎉`,
          description: '당첨자로 확인되었습니다!',
          buttons: [{ action: 'block', label: '쿠폰 발급', blockId: COUPON_BLOCK_ID }]
        }
      }]
    });
  } else {
    return res({
      outputs: [{
        basicCard: {
          title: `${name}님, 아쉽지만 이번엔 당첨자가 아닙니다 😢`,
          description: '다음 이벤트에도 꼭 참여해주세요!',
          buttons: [{ action: 'block', label: '감사 인사 보기', blockId: THANKS_BLOCK_ID }]
        }
      }]
    });
  }
}
