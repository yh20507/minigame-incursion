# -*- coding: utf-8 -*-
"""2부 스토리 공통 도우미. 각 장 파일은 SCENES dict 를 내보낸다: id -> (bg, [(speaker, text), ...])"""

def sc(bg, lines):
    return dict(bg=bg, lines=[dict(s=s, t=t) for s, t in lines])

# 새로 말하는 사람들 (speakers 에 합쳐진다)
SPEAKERS = {
  'wanderer': {'name': '방랑자'},
  'observer': {'name': '관측자', 'char': 'observer'},
  'observer_q': {'name': '???'},
  'nova': {'name': '노바', 'char': 'nova'},
  'elowen': {'name': '엘로웬', 'char': 'elowen'},
  'seraphina': {'name': '세라피나', 'char': 'seraphina'},
  'lumiere': {'name': '루미에르', 'char': 'lumiere'},
  'cassian': {'name': '카시안', 'char': 'cassian'},
  'seraphina_x': {'name': '[이변] 세라피나', 'char': 'seraphina_x'}, 'lumiere_x': {'name': '[이변] 루미에르', 'char': 'lumiere_x'},
  # 서리
  'ur': {'name': '우르', 'char': 'ur'}, 'nell': {'name': '넬', 'char': 'nell'}, 'gretel': {'name': '그레텔', 'char': 'gretel'},
  'bastian': {'name': '바스티안', 'char': 'bastian'}, 'isu': {'name': '이스', 'char': 'isu'}, 'kairos': {'name': '카이로스', 'char': 'kairos'},
  'chrono': {'name': '크로노', 'char': 'chrono'}, 'halma': {'name': '할마', 'char': 'halma'},
  # 심해
  'moss': {'name': '모스', 'char': 'moss'}, 'lilia': {'name': '릴리아', 'char': 'lilia'}, 'harold': {'name': '해롤드', 'char': 'harold'},
  'yur': {'name': '유르', 'char': 'yur'}, 'sasha': {'name': '사샤', 'char': 'sasha'}, 'nerei': {'name': '네레이', 'char': 'nerei'}, 'bell': {'name': '벨', 'char': 'bell'},
  # 하늘
  'toby': {'name': '토비', 'char': 'toby'}, 'mia': {'name': '미아', 'char': 'mia'}, 'rufe': {'name': '루프', 'char': 'rufe'},
  'enya': {'name': '엔야', 'char': 'enya'}, 'cedric': {'name': '세드릭', 'char': 'cedric'}, 'aurel': {'name': '아우렐', 'char': 'aurel'}, 'zephy': {'name': '제피', 'char': 'zephy'},
  # 유리
  'dar': {'name': '다르', 'char': 'dar'}, 'sahara': {'name': '사하라', 'char': 'sahara'}, 'omar': {'name': '오마르', 'char': 'omar'},
  'rina': {'name': '리나', 'char': 'rina'}, 'kasim': {'name': '카심', 'char': 'kasim'}, 'silvan': {'name': '실반', 'char': 'silvan'}, 'aina': {'name': '아이나', 'char': 'aina'},
  # 종이
  'ink': {'name': '잉크', 'char': 'ink'}, 'fold': {'name': '폴드', 'char': 'fold'}, 'marion': {'name': '마리온', 'char': 'marion'},
  'theo': {'name': '테오', 'char': 'theo'}, 'viola': {'name': '비올라', 'char': 'viola'}, 'colette': {'name': '콜레트', 'char': 'colette'},
  'orphe': {'name': '오르페', 'char': 'orphe'}, 'fin': {'name': '핀', 'char': 'fin'},
  # 1부 추가 장면용
  'heim': {'name': '하임', 'char': 'heim'}, 'brenda': {'name': '브렌다', 'char': 'brenda'}, 'felix': {'name': '펠릭스', 'char': 'felix'},
  'nia': {'name': '니아', 'char': 'nia'}, 'yuna': {'name': '유나', 'char': 'yuna'}, 'roxy': {'name': '록시', 'char': 'roxy'}, 'silva': {'name': '실바', 'char': 'silva'},
  'tan': {'name': '탄', 'char': 'tan'}, 'koda': {'name': '코다', 'char': 'koda'}, 'leo': {'name': '레오', 'char': 'leo'},
  'astrid': {'name': '아스트리드', 'char': 'astrid'}, 'kirill': {'name': '키릴', 'char': 'kirill'}, 'qura': {'name': '큐-라', 'char': 'qura'},
  'onyx': {'name': '오닉스', 'char': 'onyx'}, 'fip': {'name': '피프', 'char': 'fip'}, 'b07': {'name': 'B-07', 'char': 'b07'}, 'drake': {'name': '드레이크', 'char': 'drake'},
  'isolde': {'name': '이솔데', 'char': 'isolde'}, 'marcus': {'name': '마르쿠스', 'char': 'marcus'}, 'kai': {'name': '카이', 'char': 'kai'}, 'bas': {'name': '바스', 'char': 'bas'},
}
