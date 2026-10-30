# -*- coding: utf-8 -*-
"""2부 「닫히지 않은 책」 데이터 생성: 대륙 6, 동료 42, 미니게임 27, 원정 목록.
기존 json 에 덧붙인다 (id 중복이면 덮어씀). 사용: python3 tools/part2_data.py
"""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')

def load(n):
    return json.load(open(os.path.join(ROOT, n), encoding='utf-8'))
def save(n, d):
    json.dump(d, open(os.path.join(ROOT, n), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
def upsert(lst, items):
    m = {x['id']: i for i, x in enumerate(lst)}
    for it in items:
        if it['id'] in m: lst[m[it['id']]] = it
        else: lst.append(it)

# ---------------------------------------------------------------- 대륙
DOMAINS = [
 dict(id='frost', name='서리 시계탑', subtitle='시간이 얼어붙은 탑 도시', part=2,
      desc='거대한 시계탑을 중심으로 나선처럼 감긴 도시. 어느 날 탑의 큰 시계가 멈추자 도시의 시간도 함께 얼어붙었다. 녹지 않는 눈 속에서 태엽 소리만 들린다.',
      color='#9fe0ff', dark='#1b2838', sky=['#2a3f5c', '#0d1422'], games=['pendulum','gears','icicle','snowball'], bossStars=6, gatekeeper='halma', unlockAfter='final', landing=True, mapPos=[260,230],
      music=dict(root=62, scale='minor', tempo=84)),
 dict(id='abyss', name='심해 등대', subtitle='빛이 꺼져 가는 바다', part=2,
      desc='바다 밑바닥에 세워진 등대와 그 둘레의 해저 마을. 등불이 하나씩 꺼지고, 어둠이 마을을 삼키고 있다. 빛이 닿지 않는 곳의 것들은 이름을 잃는다.',
      color='#4fd1c5', dark='#0f2a2e', sky=['#0a3038', '#030c10'], games=['sonar','lighthouse','dive','cipher'], bossStars=6, gatekeeper='bell', unlockAfter='frost', landing=True, mapPos=[640,380],
      music=dict(root=55, scale='dorian', tempo=72)),
 dict(id='sky', name='하늘 정원', subtitle='떠 있는 섬들의 정원', part=2,
      desc='구름 위에 떠 있는 수십 개의 섬. 섬마다 정원이 있고, 정원사가 바람으로 섬을 묶어 두었다. 바람이 약해지며 섬들이 하나씩 떨어지기 시작했다.',
      color='#b8f28b', dark='#1d3320', sky=['#6fb0e8', '#2d5a8a'], games=['hop','farm','flock','climb'], bossStars=6, gatekeeper='zephy', unlockAfter='abyss', landing=True, mapPos=[1020,180],
      music=dict(root=64, scale='lydian', tempo=104)),
 dict(id='glass', name='유리 사막', subtitle='모든 것이 비치는 거울의 땅', part=2,
      desc='모래 대신 유리 가루가 깔린 사막. 밤이면 모래가 거울처럼 하늘을 비춘다. 거울 속의 것들이 진짜를 대신하기 시작했고, 누구도 자신이 원본인지 확신하지 못한다.',
      color='#f2c4ff', dark='#2e1f36', sky=['#5a3f6e', '#1a1022'], games=['mirror','spot','storm','shatter'], bossStars=6, gatekeeper='aina', unlockAfter='sky', landing=True, mapPos=[1400,340],
      music=dict(root=59, scale='phrygian', tempo=92)),
 dict(id='paper', name='종이 극장', subtitle='막이 내리지 않는 무대', part=2,
      desc='종이로 접은 건물과 종이 인형 배우들의 도시. 모든 주민이 배역을 가지고 있고, 대본이 끝나면 막이 내린다. 지금, 마지막 장이 쓰이고 있다.',
      color='#ffb3a7', dark='#3a2222', sky=['#6b3a3a', '#241212'], games=['lines','stage','plane','spotlight'], bossStars=6, gatekeeper='fin', unlockAfter='glass', landing=True, mapPos=[1700,560],
      music=dict(root=60, scale='major', tempo=112)),
 dict(id='library', name='관측자의 서재', subtitle='모든 이야기가 꽂히는 곳', part=2, final=True,
      desc='끝난 이야기들이 책이 되어 꽂히는 끝없는 서가. 관측자는 여기서 세계를 읽고, 다 읽은 세계를 덮는다. 조각세계의 책은 아직 펼쳐져 있다.',
      color='#ffe08a', dark='#2a2418', sky=['#3a2f18', '#120e06'], games=['pages'], bossStars=0, gatekeeper='observer', unlockAfter='paper', landing=True, mapPos=[1000,760],
      music=dict(root=57, scale='minor', tempo=76)),
]

# ---------------------------------------------------------------- 원정 (대륙 좌표)
FRONTIERS = [
 dict(id='frost', name='서리 시계탑', subtitle='시간이 얼어붙은 탑 도시', color='#9fe0ff', need=100, unlockAfter='final',
      stages=[dict(at=0,text='균열 너머 해역에서 희미한 신호가 잡혔다. 좌표 조각을 모아 위치를 좁혀 가자.'),dict(at=25,text='안개 사이로 얼어붙은 실루엣이 보인다. 하늘을 찌르는 탑 같은 것.'),dict(at=50,text="대륙의 이름이 드러났다. 시간이 얼어붙은 탑 도시, '서리 시계탑'."),dict(at=75,text='탑 꼭대기에서 커다란 시계 소리가 들린다. 누군가 탑을 지키고 있다.'),dict(at=100,text='좌표 확정! 경계의 수호자를 넘으면 상륙할 수 있다.')],
      landed='상륙 성공! 서리 시계탑이 조각세계 지도에 이어졌다.'),
 dict(id='abyss', name='심해 등대', subtitle='빛이 꺼져 가는 바다', color='#4fd1c5', need=120, unlockAfter='frost',
      stages=[dict(at=0,text='시계탑 아래 얼음 바다에서 규칙적인 빛이 깜빡인다. 모스 부호 같다.'),dict(at=25,text='빛은 수면이 아니라 바다 밑에서 올라온다. 누군가 신호를 보내고 있다.'),dict(at=50,text="해독 완료: '불이 꺼진다. 도와 달라.' 발신지는 심해의 등대."),dict(at=75,text='등대 주위에 마을이 있다. 등불이 하나 꺼질 때마다 집 한 채가 지도에서 사라진다.'),dict(at=100,text='좌표 확정! 깊은 곳의 수호자를 넘으면 잠수할 수 있다.')],
      landed='잠수 성공! 심해 등대가 조각세계 지도에 이어졌다.'),
 dict(id='sky', name='하늘 정원', subtitle='떠 있는 섬들의 정원', color='#b8f28b', need=140, unlockAfter='abyss',
      stages=[dict(at=0,text='바다 위로 꽃잎이 떨어진다. 이 해역엔 꽃이 피는 땅이 없는데.'),dict(at=25,text='꽃잎은 위에서 온다. 구름 사이로 떠 있는 섬의 그림자가 보인다.'),dict(at=50,text="섬들은 바람으로 묶여 있다. 이름은 '하늘 정원'. 바람이 약해지고 있다."),dict(at=75,text='섬 하나가 떨어졌다. 바다에 꽂힌 정원이 천천히 가라앉는다. 서둘러야 한다.'),dict(at=100,text='좌표 확정! 바람의 수호자를 넘으면 올라갈 수 있다.')],
      landed='상승 성공! 하늘 정원이 조각세계 지도에 이어졌다.'),
 dict(id='glass', name='유리 사막', subtitle='모든 것이 비치는 거울의 땅', color='#f2c4ff', need=160, unlockAfter='sky',
      stages=[dict(at=0,text='지평선에 똑같은 배가 한 척 더 떠 있다. 우리 배다. 우리가 손을 흔들면 저쪽도 흔든다.'),dict(at=25,text='거울처럼 비치는 사막이 바다와 맞닿아 있다. 비친 쪽의 하늘에는 별이 하나 더 많다.'),dict(at=50,text="'유리 사막'. 상인들 말로는, 거울 속에서 나온 것이 진짜를 대신한다고 한다."),dict(at=75,text='원정대원 하나가 묻는다. "내가 돌아온 그 사람이 맞는지 어떻게 알아?" 아무도 대답하지 못했다.'),dict(at=100,text='좌표 확정! 거울의 수호자를 넘으면 건널 수 있다.')],
      landed='횡단 성공! 유리 사막이 조각세계 지도에 이어졌다.'),
 dict(id='paper', name='종이 극장', subtitle='막이 내리지 않는 무대', color='#ffb3a7', need=180, unlockAfter='glass',
      stages=[dict(at=0,text='바람에 종이 한 장이 날아왔다. 대본의 한 페이지다. 등장인물 이름 중에 우리 이름이 있다.'),dict(at=25,text='종이로 접은 도시가 보인다. 거리마다 무대가 있고, 모두가 연기를 하고 있다.'),dict(at=50,text="'종이 극장'. 대본이 끝나면 막이 내리고, 막이 내리면 도시가 접힌다."),dict(at=75,text='날아온 페이지는 마지막 장이었다. 마지막 대사 옆에 이렇게 적혀 있다: "(여기서 끝.)"'),dict(at=100,text='좌표 확정! 무대의 수호자를 넘으면 입장할 수 있다.')],
      landed='입장 성공! 종이 극장이 조각세계 지도에 이어졌다.'),
 dict(id='library', name='관측자의 서재', subtitle='모든 이야기가 꽂히는 곳', color='#ffe08a', need=200, unlockAfter='paper',
      stages=[dict(at=0,text='다섯 대륙의 재앙이 전부 한 방향을 가리킨다. 지도 바깥, 아무것도 없어야 할 곳.'),dict(at=25,text='그곳엔 문이 하나 떠 있다. 문 너머로 끝없이 이어진 서가가 보인다.'),dict(at=50,text="틈새가 말했다. \"저기... 나 저 문 알아. 기억은 안 나는데, 알아.\""),dict(at=75,text='서가의 책 한 권이 펼쳐져 있다. 표지에 적힌 제목은 「조각세계」. 마지막 장이 비어 있다.'),dict(at=100,text='좌표 확정. 마지막 수호자는 없다. 문은 열려 있다.')],
      landed='관측자의 서재에 들어섰다. 마지막 장이 시작된다.'),
]

# ---------------------------------------------------------------- 미니게임
GAMES = [
 # 기존 영역 5번째
 dict(id='defend', domain='ashen', genre='수비', name='성문 수비', controls='마우스 클릭: 그 자리에 화살 발사 · 1~3: 궁수 배치', rule='성문으로 밀려오는 공성 병기를 화살로 막아라. 성문이 뚫리면 목숨이 줄어든다.', lives=3, stars=[900,2000,3400], coinRate=0.14, micro='막아라!'),
 dict(id='courier', domain='neon', genre='경로', name='배달 드론', controls='마우스 드래그: 격자 위에 경로 그리기', rule='제한시간 안에 배달지를 모두 잇는 경로를 그려라. 막힌 칸과 교차는 금지.', lives=2, stars=[700,1600,2800], coinRate=0.16, micro='이어라!'),
 dict(id='golf', domain='nebula', genre='물리', name='중력 골프', controls='마우스 드래그: 방향·세기 → 놓으면 발사', rule='행성 중력을 이용해 공을 구멍에 넣어라. 적게 칠수록 고득점, 블랙홀에 빠지면 목숨이 줄어든다.', lives=3, stars=[800,1800,3000], coinRate=0.15, micro='넣어라!'),
 # 5장 서리 시계탑
 dict(id='pendulum', domain='frost', genre='정밀 타이밍', name='시계추 멈추기', controls='스페이스: 추 멈추기', rule='흔들리는 시계추를 표시 구간 안에서 멈춰라. 구간은 점점 좁아지고 추는 점점 변덕스러워진다.', lives=3, stars=[800,1800,3000], coinRate=0.15, micro='멈춰라!'),
 dict(id='gears', domain='frost', genre='회전 퍼즐', name='톱니 조립', controls='마우스 클릭: 톱니 조각 90° 회전', rule='조각을 돌려 동력을 출구까지 이어라. 판을 완성할수록 커지고, 시간이 다 되면 끝.', lives=1, stars=[600,1400,2400], coinRate=0.18, micro='이어라!'),
 dict(id='icicle', domain='frost', genre='자원 회피', name='고드름 시간정지', controls='← →: 이동 · 스페이스(길게): 시간 느리게 (게이지 소모)', rule='떨어지는 고드름을 피하라. 시간 정지 게이지는 쓰면 줄고 안 쓰면 찬다. 떨어진 눈꽃을 주우면 점수.', lives=2, stars=[900,2000,3400], coinRate=0.14, micro='피해라!'),
 dict(id='snowball', domain='frost', genre='힘·각도', name='눈덩이 볼링', controls='스페이스(길게): 눈덩이 키우기 → 놓으면 굴림 · ← →: 방향', rule='눈덩이를 키워 얼음 핀을 쓰러뜨려라. 클수록 세지만 느리고, 너무 크면 터진다.', lives=3, stars=[800,1800,3000], coinRate=0.15, micro='굴려라!'),
 # 6장 심해 등대
 dict(id='sonar', domain='abyss', genre='파문 기억', name='소나 탐지', controls='스페이스: 핑 (파문으로 잠깐 보임) · 마우스 클릭: 보물 위치 지목', rule='캄캄한 바다에 핑을 쏘면 보물이 잠깐 드러난다. 기억해서 정확히 찍어라. 핑은 횟수 제한.', lives=3, stars=[700,1600,2800], coinRate=0.16, micro='찾아라!'),
 dict(id='lighthouse', domain='abyss', genre='유도', name='등대 돌리기', controls='← →: 빛줄기 회전', rule='다가오는 배를 빛으로 비춰 암초를 피하게 하라. 배가 여러 척이면 빛을 나눠 써야 한다.', lives=3, stars=[800,1800,3000], coinRate=0.15, micro='비춰라!'),
 dict(id='dive', domain='abyss', genre='관성 회피', name='해파리 잠수', controls='↑ ↓: 부력 조절 (천천히 움직인다)', rule='해파리 사이로 잠수하라. 전류가 켜지는 박자를 읽고, 공기방울로 산소를 채워라.', lives=2, stars=[900,2000,3400], coinRate=0.14, micro='지나가라!'),
 dict(id='cipher', domain='abyss', genre='추론', name='보물 해독', controls='마우스 클릭: 다음에 올 기호 고르기', rule='기호가 늘어선 규칙을 읽고 다음 기호를 골라라. 맞을수록 규칙이 복잡해진다.', lives=3, stars=[600,1400,2400], coinRate=0.18, micro='풀어라!'),
 # 7장 하늘 정원
 dict(id='hop', domain='sky', genre='예측 점프', name='섬 건너뛰기', controls='스페이스(길게): 점프 세기 · 바람 화살표를 읽어라', rule='바람에 휘는 궤적을 계산해 다음 섬으로 뛰어라. 떨어지면 목숨이 줄어든다.', lives=2, stars=[800,1800,3000], coinRate=0.15, micro='뛰어라!'),
 dict(id='farm', domain='sky', genre='실시간 관리', name='씨앗 심기', controls='마우스 클릭: 밭 칸 (심기→물주기→수확) · 새를 클릭하면 쫓는다', rule='씨앗을 심고 물을 주고 수확하라. 새가 쪼아먹기 전에 쫓아내라. 익은 걸 놔두면 시든다.', lives=1, stars=[700,1600,2800], coinRate=0.16, micro='거둬라!'),
 dict(id='flock', domain='sky', genre='군집 유도', name='새떼 몰이', controls='마우스: 새떼는 커서를 피한다 → 링 안으로 몰아넣어라', rule='커서를 피하는 새떼를 빛나는 링 안으로 몰아라. 링은 점점 작아지고 자리를 옮긴다.', lives=1, stars=[600,1400,2400], coinRate=0.18, micro='몰아라!'),
 dict(id='climb', domain='sky', genre='번갈아 등반', name='구름 사다리', controls='← →: 왼손·오른손 번갈아 잡기 · 끊어진 칸은 건너뛰기(같은 손 두 번)', rule='구름 사다리를 리듬에 맞춰 올라라. 끊어진 칸을 잡으면 미끄러진다. 밑에서 안개가 올라온다.', lives=1, stars=[900,2000,3400], coinRate=0.14, micro='올라라!'),
 # 8장 유리 사막
 dict(id='mirror', domain='glass', genre='빛 경로 퍼즐', name='거울 반사', controls='마우스 클릭: 거울 회전', rule='거울을 돌려 빛을 모든 수정에 닿게 하라. 판을 완성할수록 거울이 늘어난다.', lives=1, stars=[600,1400,2400], coinRate=0.18, micro='비춰라!'),
 dict(id='spot', domain='glass', genre='관찰', name='신기루 찾기', controls='마우스 클릭: 두 그림에서 다른 곳 찍기', rule='진짜와 신기루 사이의 다른 점을 찾아라. 틀린 곳을 찍으면 시간이 깎인다.', lives=3, stars=[700,1600,2800], coinRate=0.16, micro='찾아라!'),
 dict(id='storm', domain='glass', genre='시야 제한 질주', name='모래폭풍 질주', controls='← → ↑ ↓: 이동', rule='모래폭풍 속에서 표지판이 가리킨 방향으로 달려라. 시야는 점점 좁아지고 표지판은 금방 묻힌다.', lives=2, stars=[800,1800,3000], coinRate=0.15, micro='달려라!'),
 dict(id='shatter', domain='glass', genre='연쇄 타격', name='유리 깨기', controls='마우스 클릭: 유리구슬 깨기 (같은 색 연속이면 연쇄)', rule='떠다니는 유리구슬을 깨라. 같은 색을 연속으로 깨면 연쇄 폭발. 검은 구슬을 깨면 목숨이 줄어든다.', lives=3, stars=[900,2000,3400], coinRate=0.14, micro='깨라!'),
 # 9장 종이 극장
 dict(id='lines', domain='paper', genre='언어', name='대사 받아치기', controls='마우스 클릭 / 1~3: 빈칸에 맞는 단어 고르기', rule='흘러가는 대사의 빈칸에 맞는 단어를 골라라. 틀리면 관객이 야유하고 목숨이 줄어든다.', lives=3, stars=[700,1600,2800], coinRate=0.16, micro='받아쳐라!'),
 dict(id='stage', domain='paper', genre='순서 기억', name='무대 전환', controls='마우스 클릭: 소품을 본 순서대로 누르기', rule='커튼이 열릴 때 소품이 빛나는 순서를 외워 그대로 눌러라. 막이 갈수록 순서가 길어진다.', lives=3, stars=[600,1400,2400], coinRate=0.18, micro='따라해라!'),
 dict(id='plane', domain='paper', genre='활공', name='종이비행기', controls='스페이스(길게): 기수 올리기 · 상승기류를 타라', rule='종이비행기를 오래, 멀리 날려라. 상승기류를 타고 커튼 봉과 조명을 피하라.', lives=2, stars=[800,1800,3000], coinRate=0.15, micro='날려라!'),
 dict(id='spotlight', domain='paper', genre='추적', name='조명 큐', controls='마우스: 스포트라이트 이동', rule='무대 위를 뛰어다니는 배우를 스포트라이트로 계속 비춰라. 비춘 시간만큼 점수, 놓치면 관객이 떠난다.', lives=3, stars=[900,2000,3400], coinRate=0.14, micro='비춰라!'),
 # 10장
 dict(id='pages', domain='library', genre='변주', name='페이지 넘기기', controls='페이지마다 규칙이 바뀐다 · 화면 지시를 따라라', rule='책장이 넘어갈 때마다 아홉 대륙의 규칙 중 하나가 펼쳐진다. 읽고, 적응하고, 버텨라.', lives=3, stars=[1500,3500,6000], coinRate=0.2, micro='읽어라!'),
]

# ---------------------------------------------------------------- 동료
def ch(id, name, title, domain, rarity, desc, line, look, passives, skill=None, voice=None, origin='original', unlock=None, theme=None):
    d = dict(id=id, name=name, title=title, origin=origin, domain=domain, rarity=rarity, pool=origin != 'special', passives=passives, desc=desc, look=look, line=line)
    if unlock: d['unlock'] = unlock
    if voice: d['voice'] = voice
    if skill: d['skill'] = skill
    return d

P = lambda **k: [dict(type=t, value=v) for t, v in k.items()]
V = lambda pitch, speed=1.0, wave='square', formant=1.0: dict(pitch=pitch, speed=speed, wave=wave, formant=formant)

CHARS = [
 # ===== 서리 시계탑
 ch('ur','우르','굴뚝 청소부','frost',1,'얼어붙은 도시에서 유일하게 연기가 나는 굴뚝을 찾아다니는 소년. 따뜻한 곳엔 아직 시간이 흐른다고 믿는다.','연기 나는 굴뚝은 아직 살아 있는 집이에요.','soot-covered boy, oversized scarf, chimney brush, snow on cap, pixel style',P(coin=8)),
 ch('nell','넬','찻집 소녀','frost',1,'시계탑 아래 찻집에서 식지 않는 차를 내는 소녀. 손님의 시간은 멈췄지만 찻잔은 아직 따뜻하다.','차 한 잔 드실래요? 식을 틈이 없어서요.','girl in apron holding steaming teapot, frost on window behind, warm lantern light',P(time=2)),
 ch('gretel','그레텔','톱니 수리공','frost',2,'탑의 톱니를 손보던 수리공. 멈춘 시계를 고치려다 손끝만 시간 속에 갇혔다.','톱니 하나가 빠지면 전부 멈춰요. 세계도 그래요.','mechanic woman with goggles, brass gears on belt, one frozen glowing hand',P(score=8,coin=6)),
 ch('bastian','바스티안','얼음 조각가','frost',2,'얼음으로 멈춘 순간을 깎아 보존하는 조각가. 녹지 않는 눈을 재료 삼아 도시 사람들의 마지막 표정을 남긴다.','녹지 않으니까 영원하지. 그게 좋은 건지는 모르겠지만.','ice sculptor with chisel, frost beard, carving a translucent statue',P(shield=1)),
 ch('isu','이스','시간 기록관','frost',3,'탑의 시계가 멈춘 정확한 순간을 기록한 유일한 사람. 그 뒤로 매 순간을 적으며 시간이 흐른다는 증거를 모은다.','기록하는 한, 시간은 흐른 거예요.','archivist in long coat, quill and pocket watch, stacks of frozen pages, calm eyes',P(time=4),voice=V(240,0.9,'triangle')),
 ch('kairos','카이로스','멈춘 시계의 기사','frost',4,'시계탑을 지키던 기사. 시계가 멈추던 순간 검을 휘두르고 있었고, 그 한 번의 베기가 아직 끝나지 않았다.','내 검은 아직 그 순간을 베고 있다.','knight with clock-face shield, frost-blue armor, sword mid-swing frozen in ice shards',P(score=15,time=3),skill=dict(id='last_moment',kind='late_bloom',name='마지막 순간',p=dict(last=15,mult=1.8)),voice=V(140,0.85,'sawtooth',0.8)),
 ch('chrono','크로노','시계탑의 심장','frost',5,'탑의 가장 깊은 곳에서 태어난 태엽 아이. 멈춘 시계의 초침 하나를 품고 있어, 세계가 멈춰도 혼자 움직인다.','째깍. ...들려? 나만 들리는 거야?','small automaton child with glass chest showing a ticking heart, brass and frost, oversized key on back, gentle glow',P(score=20,coin=15,shield=1),skill=dict(id='time_stop',kind='time_stop',name='태엽 멈춤',active=True,p=dict(dur=2)),voice=V(360,1.1,'triangle',1.2)),
 ch('halma','할마','태엽지기','frost',4,'탑의 큰 시계를 돌리던 늙은 자동인형. 관측자가 시계를 멈추자 스스로를 문지기로 삼아 누구도 탑에 오르지 못하게 막았다.','시계를 다시 돌리면, 끝도 다시 다가온단다.','old clockwork automaton grandmother, brass joints, shawl of gears, lantern with frozen flame',P(score=20,shield=1,coin=10),skill=dict(id='slow_gear',kind='chill',name='태엽 감속',p=dict(dur=3,factor=0.5)),origin='special',unlock='서리 시계탑 보스 스테이지 클리어',voice=V(170,0.7,'sawtooth',0.75)),
 # ===== 심해 등대
 ch('moss','모스','조개 줍는 아이','abyss',1,'등대 발치에서 빛나는 조개를 줍는 아이. 조개 속 빛으로 집에 가는 길을 표시한다.','이 조개는 아직 빛나요. 이쪽이 집이에요.','small kid with glowing shell bucket, diving goggles on forehead, bioluminescent freckles',P(coin=8)),
 ch('lilia','릴리아','심해 요리사','abyss',1,'어둠 속에서도 냄새만으로 요리하는 해저 마을의 요리사. 등불이 꺼진 집에 따뜻한 국을 돌린다.','불 없이도 끓일 수 있어요. 방법이 있죠.','cheerful cook with glowing jellyfish lamp hat, ladle, bubbles around',P(time=2)),
 ch('harold','해롤드','잠수부','abyss',2,'등대의 꺼진 등불을 되살릴 연료를 찾아 더 깊은 곳으로 내려가는 잠수부. 매번 조금씩 더 늦게 돌아온다.','밑에는 아직 빛이 있어. 멀어서 그렇지.','old diver in brass helmet, rope around waist, carrying glowing fuel canister',P(shield=1)),
 ch('yur','유르','소라 음악가','abyss',2,'소라 껍데기로 바다 밑의 소리를 연주하는 음악가. 어둠 속에서 길을 잃은 사람은 그 소리를 따라온다.','빛이 없으면 소리로 길을 내면 돼.','musician with giant conch horn, flowing seaweed hair, sound ripples visible',P(score=8,coin=6)),
 ch('sasha','사샤','난파선 수색가','abyss',3,'심해에 가라앉은 배들에서 이름 잃은 물건을 건져 올린다. 이름을 되찾아 주면 물건은 다시 빛난다.','이름을 불러 주면 돌아와요. 물건도, 사람도.','salvager woman with headlamp, net full of glowing relics, scar on cheek, determined',P(score=12),voice=V(230,1.0,'square')),
 ch('nerei','네레이','심해의 노래꾼','abyss',4,'바다 밑 깊은 곳에서 등대를 향해 노래하는 존재. 노랫소리가 닿는 곳의 등불은 꺼지지 않는다.','들려요? 아직 꺼지지 않았어요.','deep-sea singer with long teal hair, lantern-fish companions, flowing robes of light, ethereal (modest clothing)',P(score=15,coin=10),skill=dict(id='echo',kind='echo',name='메아리',p=dict(ratio=0.5,delay=1)),voice=V(290,0.85,'sine',1.1)),
 ch('bell','벨','등대지기','abyss',4,'마지막 등불을 지키는 등대지기. 관측자가 빛을 거두자 자신의 기억을 태워 등불을 밝히고 있다.','이름은 잊었어도, 불은 안 꺼뜨렸어.','lighthouse keeper in weathered coat, holding a lantern that burns with white memory-flame, tired kind smile',P(score=20,time=4,coin=10),skill=dict(id='lamp',kind='shield_regen',name='등불',p=dict(every=12)),origin='special',unlock='심해 등대 보스 스테이지 클리어',voice=V(120,0.8,'sawtooth',0.8)),
 # ===== 하늘 정원
 ch('toby','토비','구름 목동','sky',1,'구름 양떼를 몰고 섬 사이를 건너는 소년. 양이 떨어지면 구름이 되어 돌아온다고 믿는다.','양들아, 가장자리는 조심!','shepherd boy with crook, fluffy cloud sheep, windblown hair, floating island edge',P(coin=8)),
 ch('mia','미아','씨앗 장수','sky',1,'섬마다 다니며 씨앗을 파는 소녀. 떨어지는 섬에도 꼭 씨앗 하나를 심고 떠난다.','떨어져도 어딘가에 뿌리는 내려요.','girl with seed pouches, flower crown, paper umbrella catching wind',P(time=2)),
 ch('rufe','루프','새 조련사','sky',2,'섬 사이를 오가는 전령새를 기르는 조련사. 새들이 돌아오지 않는 섬이 늘고 있다.','새가 안 돌아오면 그 섬은 이미 없는 거야.','falconer with huge messenger bird on arm, leather gloves, goggles',P(score=8,coin=6)),
 ch('enya','엔야','바람 측정사','sky',2,'바람의 세기를 재서 섬이 떨어질 날을 계산하는 측정사. 계산이 맞을 때마다 조금씩 말수가 줄었다.','...사흘. 이 섬은 사흘이에요.','girl with wind gauge instruments, ribbons measuring wind, notebook, serious face',P(shield=1)),
 ch('cedric','세드릭','공중 정원사','sky',3,'떨어진 섬의 정원을 다른 섬에 옮겨 심는 정원사. 꽃이 뿌리내리면 섬 하나가 살아남은 셈이라고 말한다.','꽃이 살면 섬도 산 거야. 그렇게 치자.','gardener with pruning shears and watering can, moss on shoulders, vines wrapping his arms',P(coin=10,time=2),voice=V(180,0.95,'triangle')),
 ch('aurel','아우렐','바람 기수','sky',4,'바람 그 자체를 타는 기수. 떨어지는 섬 사이를 날며 주민을 실어 나른다. 바람이 멎으면 함께 떨어질 것을 안다.','바람이 있는 동안은 아무도 안 떨어뜨려.','wind rider in flowing cape riding a current of visible wind, goggles, light armor, dynamic pose',P(score=15,shield=1),skill=dict(id='gust',kind='invuln',name='돌풍',active=True,p=dict(dur=2.5,mult=1.5,cd=18)),voice=V(200,1.1,'sawtooth',0.95)),
 ch('zephy','제피','바람의 정원사','sky',4,'섬들을 바람으로 묶어 둔 첫 정원사. 관측자가 바람을 거두자 자기 숨으로 섬을 붙들고 있었다.','숨이 다하기 전에 와 줬구나.','ancient gardener spirit made of leaves and wind, long beard of petals, staff that is a living branch',P(score=20,coin=10,time=3),skill=dict(id='steady',kind='steady',name='잔잔한 바람',p=dict(every=10,sec=3)),origin='special',unlock='하늘 정원 보스 스테이지 클리어',voice=V(130,0.75,'sine',0.8)),
 # ===== 유리 사막
 ch('dar','다르','유리 장인 견습','glass',1,'모래를 녹여 거울을 만드는 공방의 견습. 자기가 만든 거울엔 절대 자기 얼굴을 비추지 않는다.','제 거울은 안 봐요. 뭐가 나올지 몰라서.','apprentice glassblower with blowpipe, sand-dusted apron, nervous eyes',P(coin=8)),
 ch('sahara','사하라','대상 소녀','glass',1,'사막을 건너는 대상(隊商)의 막내. 신기루와 진짜 오아시스를 구별하는 눈을 가졌다.','저건 가짜예요. 그림자가 없잖아요.','desert caravan girl with headscarf, holding a small compass, camel silhouette behind',P(time=2)),
 ch('omar','오마르','모래 항해사','glass',2,'유리 모래 위를 미끄러지는 썰매배의 항해사. 별이 두 개로 보이는 밤엔 출항하지 않는다.','별이 두 개면 하나는 거짓이야. 그날은 안 가.','sand sailor with wide hat, sled-ship wheel, star charts',P(score=8,coin=6)),
 ch('rina','리나','신기루 안내인','glass',2,'길 잃은 사람을 신기루 밖으로 데려다주는 안내인. 자신도 한 번 신기루에서 나온 적이 있다고, 아마도.','이쪽이 진짜 길이에요. ...아마도요.','guide with veil and lantern, footprints that shimmer, reflective eyes',P(shield=1)),
 ch('kasim','카심','거울 상인','glass',3,'거울 속에서 꺼내 온 물건을 파는 상인. 물건마다 "원본은 아님"이라는 꼬리표를 정직하게 붙인다.','원본은 아니지만, 쓰는 데는 문제없어요.','merchant with cart of mirrors, rings on every finger, sly but honest grin',P(coin=20),voice=V(190,1.05,'square')),
 ch('silvan','실반','거울 검사','glass',4,'거울 속에서 나온 자신과 매일 밤 검을 겨루는 검사. 어느 쪽이 이기든 다음 날 아침엔 한 사람만 남는다.','어젯밤엔 내가 이겼다. 아마도 내가.','swordsman with mirrored blade, half of face reflected differently, dusk desert',P(score=15,coin=10),skill=dict(id='vengeance',kind='vengeance',name='되갚음',p=dict(dur=5,mult=2)),voice=V(150,0.9,'sawtooth',0.85)),
 ch('aina','아이나','반영의 여왕','glass',4,'거울 속 사막을 다스리는 여왕. 관측자가 원본의 세계를 지우자, 비친 쪽을 진짜로 만들어 사람들을 살려 두었다.','비친 것도 살아 있어. 그걸 가짜라 부르지 마.','queen of reflections, crown of glass shards, gown that mirrors the sky, regal and sad',P(score=20,shield=1,coin=10),skill=dict(id='reflect',kind='rewrite',name='반영',p=dict(n=1)),origin='special',unlock='유리 사막 보스 스테이지 클리어',voice=V(250,0.8,'triangle',1.0)),
 # ===== 종이 극장
 ch('ink','잉크','소품 담당','paper',1,'무대 뒤에서 소품을 챙기는 아이. 대본에 없는 소품을 몰래 올려 두는 버릇이 있다.','이건 대본에 없는데... 재밌잖아요.','stagehand kid with ink-stained hands, carrying too many props, mischievous',P(coin=8)),
 ch('fold','폴드','접는 아이','paper',1,'종이를 접어 무대 세트를 만드는 아이. 접은 것은 펼 수 있다고, 도시도 그렇다고 믿는다.','접은 건 다시 펼 수 있어요. 전부 다요.','child folding origami buildings, paper crane on shoulder, focused',P(time=2)),
 ch('marion','마리온','무대 조명사','paper',2,'조명으로 배우의 표정을 만드는 조명사. 조명이 꺼진 자리는 대본에서도 사라진다는 걸 안다.','빛이 닿는 동안은 네 장면이야.','lighting technician on catwalk, spotlight in hands, headset, warm glow',P(score=8,coin=6)),
 ch('theo','테오','대본 필경사','paper',2,'대본을 베껴 쓰는 필경사. 베끼는 중에 몰래 한 줄씩 고치고 있다. 아직 아무도 눈치채지 못했다.','한 줄쯤 바꿔도 아무도 몰라. ...아직은.','scribe with quill and scroll, ink pot, candlelight, guilty smile',P(shield=1)),
 ch('viola','비올라','그림자 연극 배우','paper',3,'그림자만으로 연기하는 배우. 실체가 없어서 막이 내려도 사라지지 않는다고 스스로를 위로한다.','그림자는 막이 내려도 남아. 그렇지?','shadow puppeteer actress, silhouette with glowing eyes, paper screen behind, elegant',P(score=10,time=2),voice=V(260,0.9,'triangle')),
 ch('colette','콜레트','종이 인형사','paper',4,'종이 인형에게 배역을 주는 인형사. 대본에 없는 배역을 만들어 주면 인형이 살아난다는 걸 처음 알아낸 사람.','배역이 있으면 살아 있는 거야. 내가 줄게.','puppeteer woman with paper marionettes, cross-bar strings, flowing ribbons, theatrical costume',P(score=15,time=3),skill=dict(id='revise',kind='rewrite',name='대본 수정',p=dict(n=1)),voice=V(270,1.0,'square',1.05)),
 ch('orphe','오르페','종이 극장의 주연','paper',5,'모든 대본의 주연을 맡아 온 종이 배우. 마지막 장이 쓰이는 지금, 처음으로 대본에 없는 대사를 하려 한다.','이 대사는 대본에 없어. 내 거야.','paper-crafted lead actor, origami crown, cloak of script pages, dramatic spotlight, confident smile',P(score=20,coin=20,shield=1),skill=dict(id='finale',kind='finale',name='피날레',p=dict(last=10,mult=2)),voice=V(210,0.95,'sawtooth',0.95)),
 ch('fin','핀','극단장','paper',4,'종이 극장의 극단장. 관측자가 마지막 장을 쓰기 시작하자 막을 내리지 않으려고 같은 장면을 수천 번 반복시켰다.','막은 내리지 않아. 내가 내리지 않는 한.','theater director with top hat and cane, coat covered in script text, dramatic gesture, stage curtains',P(score=20,coin=10,time=3),skill=dict(id='interlude',kind='periodic',name='막간극',p=dict(every=12,dur=4,mult=2)),origin='special',unlock='종이 극장 보스 스테이지 클리어',voice=V(160,0.9,'sawtooth',0.85)),
 # ===== 관측자의 서재
 ch('observer','관측자','이야기를 덮는 자','library',5,'끝난 이야기를 읽고 덮어 서가에 꽂는 존재. 조각세계의 마지막 장을 쓰려 했으나, 읽는 사람이 있는 책은 덮을 수 없다는 걸 배웠다.','...다음 장은 네가 써. 나는 읽을게.','tall robed figure made of drifting pages, a single lantern eye, holding an open book, endless library behind, serene',P(score=25,coin=25,time=4),skill=dict(id='borrow',kind='borrow',name='열람',p={}),origin='special',unlock='관측자의 서재 클리어',voice=V(110,0.7,'sine',0.7)),
]

if __name__ == '__main__':
    d = load('domains.json'); upsert(d, DOMAINS); save('domains.json', d)
    g = load('minigames.json'); upsert(g, GAMES); save('minigames.json', g)
    c = load('characters.json'); upsert(c, CHARS); save('characters.json', c)
    f = load('frontier.json')
    # 예전 단일 구조 → 목록 구조
    if isinstance(f, dict):
        common = dict(shards=f['shards'], expedition=f['expedition'])
        f = dict(**common, list=FRONTIERS)
    else:
        f['list'] = FRONTIERS
    save('frontier.json', f)
    print('domains', len(d), 'games', len(g), 'chars', len(c), 'frontiers', len(f['list']))
