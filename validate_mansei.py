#!/usr/bin/env python3
"""
만세력 검증 스크립트 (Manselyeok Validation Script)
-----------------------------------------------------
index.html 의 JS 달력 로직을 Python 으로 포팅하여
양력↔음력 변환, 사주 기둥 계산을 검증합니다.

사용법:
  python3 validate_mansei.py [--mode MODE] [--year Y] [--month M] [--day D] [--hour H]

MODE:
  all       모든 검증 실행 (기본값)
  solar     양력→음력 변환 검증
  lunar     음력→양력 변환 검증
  roundtrip 양력→음력→양력 왕복 변환 검증
  saju      사주 기둥 계산 검증
  custom    --year/--month/--day/--hour 로 지정한 날짜 상세 분석

예시:
  python3 validate_mansei.py --mode all
  python3 validate_mansei.py --mode solar --year 1990 --month 3 --day 15
  python3 validate_mansei.py --mode custom --year 1985 --month 8 --day 15 --hour 14
"""

import sys
import argparse
from datetime import date, timedelta

# ─────────────────────────────────────────────
# 1. 음력 데이터 (LUNAR_INFO, 1900~2100)
# ─────────────────────────────────────────────
LUNAR_INFO = [
    19416,19168,42352,21717,53856,55632,91476,22176,39632,21970,
    19168,42422,42192,53840,119381,46400,54944,44450,38320,84343,
    18800,42160,46261,27216,27968,109396,11104,38256,21234,18800,
    25958,54432,59984,28309,23248,11104,100067,37600,116951,51536,
    54432,120998,46416,22176,107956,9680,37584,53938,43344,46423,
    27808,46416,86869,19872,42416,83315,21168,43432,59728,27296,
    44710,43856,19296,43748,42352,21088,62051,55632,23383,22176,
    38608,19925,19152,42192,54484,53840,54616,46400,46752,103846,
    38320,18864,43380,42160,45690,27216,27968,44870,43872,38256,
    19189,18800,25776,29859,59984,27480,23232,43872,38613,37600,
    51552,55636,54432,55888,30034,22176,43959,9680,37584,51893,
    43344,46240,47780,44368,21977,19360,42416,86390,21168,43312,
    31060,27296,44368,23378,19296,42726,42208,53856,60005,54576,
    23200,30371,38608,19195,19152,42192,118966,53840,54560,56645,
    46496,22224,21938,18864,42359,42160,43600,111189,27936,44448,
    84835,37744,18936,18800,25776,92326,59984,27424,108228,43744,
    37600,53987,51552,54615,54432,55888,23893,22176,42704,21972,
    21200,43448,43344,46240,46758,44368,21920,43940,42416,21168,
    45683,26928,29495,27296,44368,84821,19296,42352,21732,53600,
    59752,54560,55968,92838,22224,19168,43476,42192,53584,62034,
    54560,
]

# ─────────────────────────────────────────────
# 2. 달력 핵심 함수
# ─────────────────────────────────────────────

def _leap_month(y):
    return LUNAR_INFO[y - 1900] & 0xF

def _leap_days(y):
    if _leap_month(y):
        return 30 if (LUNAR_INFO[y - 1900] & 0x10000) else 29
    return 0

def _month_days(y, m):
    return 30 if (LUNAR_INFO[y - 1900] & (0x10000 >> m)) else 29

def _lyear_days(y):
    s = 348
    i = 0x8000
    while i > 0x8:
        if LUNAR_INFO[y - 1900] & i:
            s += 1
        i >>= 1
    return s + _leap_days(y)

def _date_to_offset(y, m, d):
    """양력 날짜를 1900-01-31 기준 offset(일수)으로 변환"""
    base = date(1900, 1, 31)
    target = date(y, m, d)
    return (target - base).days

def _offset_to_date(offset):
    """1900-01-31 기준 offset(일수)을 양력 날짜로 변환"""
    base = date(1900, 1, 31)
    return base + timedelta(days=offset)


def solar2lunar(y, m, d):
    """양력 → 음력 변환. {lYear, lMonth, lDay, isLeap} 반환"""
    offset = _date_to_offset(y, m, d)
    i = 1900
    temp = 0
    while i < 2101 and offset > 0:
        temp = _lyear_days(i)
        offset -= temp
        i += 1
    if offset < 0:
        offset += temp
        i -= 1
    l_year = i
    leap = _leap_month(l_year)
    is_leap = False
    i = 1
    while i < 13 and offset > 0:
        if leap > 0 and i == leap + 1 and not is_leap:
            i -= 1
            is_leap = True
            temp = _leap_days(l_year)
        else:
            temp = _month_days(l_year, i)
        if is_leap and i == leap + 1:
            is_leap = False
        offset -= temp
        i += 1
    if offset == 0 and leap > 0 and i == leap + 1:
        if is_leap:
            is_leap = False
        else:
            is_leap = True
            i -= 1
    if offset < 0:
        offset += temp
        i -= 1
    return {"lYear": l_year, "lMonth": i, "lDay": offset + 1, "isLeap": is_leap}


def lunar2solar(ly, lm, ld, is_leap=False):
    """음력 → 양력 변환. date 객체 반환. 실패 시 None"""
    try:
        offset = 0
        for i in range(1900, ly):
            offset += _lyear_days(i)
        leap_m = _leap_month(ly)
        for i in range(1, lm):
            offset += _month_days(ly, i)
            if leap_m == i:
                offset += _leap_days(ly)
        if is_leap:
            offset += _month_days(ly, lm)
        offset += ld - 1
        return _offset_to_date(offset)
    except Exception:
        return None


# ─────────────────────────────────────────────
# 3. 사주 기둥 계산
# ─────────────────────────────────────────────

천간 = ['갑','을','병','정','무','기','경','신','임','계']
지지 = ['자','축','인','묘','진','사','오','미','신','유','술','해']
천간한자 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
지지한자 = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
천간오행 = ['목','목','화','화','토','토','금','금','수','수']
지지오행 = ['수','토','목','목','토','화','화','토','금','금','토','수']
절기입절 = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7]  # 월별 절기 입절일(근사값)


def get_yp(y, m, d):
    """연주(年柱): 입춘(2/4경) 기준으로 전년도 처리"""
    yr = y
    if m < 2 or (m == 2 and d < 4):
        yr = y - 1
    g = ((yr - 4) % 10 + 10) % 10
    j = ((yr - 4) % 12 + 12) % 12
    return {"g": g, "j": j}


def get_mp(y, m, d, yg):
    """월주(月柱): 절기 입절일 기준"""
    sm = m
    if d < 절기입절[m - 1]:
        sm = m - 1
    if sm <= 0:
        sm = 12
    ji = sm % 12
    s_table = [2, 4, 6, 8, 0]
    s = s_table[yg % 5]
    ord_val = sm - 2 if sm - 2 >= 0 else sm + 10
    g = (s + ord_val) % 10
    return {"g": g, "j": ji}


def get_dp(y, m, d):
    """일주(日柱): 1900-01-01 갑자일 기준"""
    base = date(1900, 1, 1)
    target = date(y, m, d)
    diff = (target - base).days
    g = ((0 + diff) % 10 + 10) % 10
    j = ((10 + diff) % 12 + 12) % 12
    return {"g": g, "j": j}


def get_hp(dg, h):
    """시주(時柱): 시간 기준"""
    if h >= 23 or h < 1:
        ji = 0
    elif h < 3:
        ji = 1
    elif h < 5:
        ji = 2
    elif h < 7:
        ji = 3
    elif h < 9:
        ji = 4
    elif h < 11:
        ji = 5
    elif h < 13:
        ji = 6
    elif h < 15:
        ji = 7
    elif h < 17:
        ji = 8
    elif h < 19:
        ji = 9
    elif h < 21:
        ji = 10
    else:
        ji = 11
    s_table = [0, 2, 4, 6, 8]
    g = (s_table[dg % 5] + ji) % 10
    return {"g": g, "j": ji}


def pillar_str(p):
    return f"{천간[p['g']]}{지지[p['j']]}({천간한자[p['g']]}{지지한자[p['j']]})"


def ohaeng_str(p):
    return f"{천간오행[p['g']]}/{지지오행[p['j']]}"


# ─────────────────────────────────────────────
# 4. 검증 케이스 (알려진 정답)
# ─────────────────────────────────────────────

# (양력 year, month, day, 기대 음력 year, 기대 음력 month, 기대 음력 day, isLeap)
SOLAR2LUNAR_CASES = [
    (1900,  1, 31,  1900,  1,  1, False),  # 경자년 1월 1일 (음)
    (1990,  1,  1,  1989, 12,  5, False),
    (1990,  3, 15,  1990,  2, 19, False),
    (2000,  1,  1,  1999, 11, 25, False),
    (2000,  2,  5,  2000,  1,  1, False),  # 경진년 1월 1일 (음)
    (2023,  1, 22,  2023,  1,  1, False),  # 계묘년 1월 1일 (음)
    (2024,  2, 10,  2024,  1,  1, False),  # 갑진년 1월 1일 (음)
    (1995,  9,  9,  1995,  8, 15, False),  # 추석 (을해년)
    (2023,  9, 29,  2023,  8, 15, False),  # 계묘년 추석
    (1985,  8, 15,  1985,  6, 29, False),
    (2026,  1,  1,  2025, 11, 13, False),  # 오늘 기준 근처
]

# (음력 year, month, day, isLeap, 기대 양력 year, month, day)
LUNAR2SOLAR_CASES = [
    (1900,  1,  1, False, 1900,  1, 31),
    (1990,  2, 19, False, 1990,  3, 15),
    (2000,  1,  1, False, 2000,  2,  5),
    (2023,  1,  1, False, 2023,  1, 22),
    (2024,  1,  1, False, 2024,  2, 10),
    (2023,  8, 15, False, 2023,  9, 29),
    (1995,  8, 15, False, 1995,  9,  9),
]

# 사주 기둥 검증: (year, month, day, hour, yp_expected, mp_expected, dp_expected, hp_expected)
# 각 기둥은 "천간지지" 문자열
SAJU_CASES = [
    # 갑자년 병인월 기사일 갑자시 (1984-02-05 00시)
    (1984,  2,  5,  0, "갑자", "병인", "기사", "갑자"),
    # 무자년 을묘월 갑인일 경오시 (2008-03-15 12시)
    (2008,  3, 15, 12, "무자", "을묘", "갑인", "경오"),
    # 계묘년 신유월 경인일 임오시 (2023-09-29 12시)
    (2023,  9, 29, 12, "계묘", "신유", "경인", "임오"),
]


# ─────────────────────────────────────────────
# 5. 검증 로직
# ─────────────────────────────────────────────

PASS = "\033[92m✓ PASS\033[0m"
FAIL = "\033[91m✗ FAIL\033[0m"
INFO = "\033[94m•\033[0m"


def validate_solar2lunar(year=None, month=None, day=None):
    print("\n" + "="*60)
    print("  [검증] 양력 → 음력 변환 (solar2lunar)")
    print("="*60)

    cases = SOLAR2LUNAR_CASES
    if year and month and day:
        # 기대값 없이 계산 결과만 출력
        r = solar2lunar(year, month, day)
        leap_str = " (윤달)" if r["isLeap"] else ""
        print(f"\n  입력: 양력 {year}-{month:02d}-{day:02d}")
        print(f"  결과: 음력 {r['lYear']}-{r['lMonth']:02d}-{r['lDay']:02d}{leap_str}")
        return

    passed = failed = 0
    for sy, sm, sd, ey, em, ed, el in cases:
        r = solar2lunar(sy, sm, sd)
        ok = (r["lYear"] == ey and r["lMonth"] == em and r["lDay"] == ed and r["isLeap"] == el)
        leap_tag = "(윤)" if r["isLeap"] else "    "
        exp_leap = "(윤)" if el else "    "
        status = PASS if ok else FAIL
        print(f"  {status}  양력 {sy}-{sm:02d}-{sd:02d}  →  "
              f"음력 {r['lYear']}-{r['lMonth']:02d}-{r['lDay']:02d}{leap_tag}  "
              f"[기대: {ey}-{em:02d}-{ed:02d}{exp_leap}]")
        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n  결과: {passed}개 통과, {failed}개 실패")
    return passed, failed


def validate_lunar2solar(year=None, month=None, day=None):
    print("\n" + "="*60)
    print("  [검증] 음력 → 양력 변환 (lunar2solar)")
    print("="*60)

    cases = LUNAR2SOLAR_CASES
    if year and month and day:
        r = lunar2solar(year, month, day, False)
        print(f"\n  입력: 음력 {year}-{month:02d}-{day:02d}")
        print(f"  결과: 양력 {r}")
        return

    passed = failed = 0
    for ly, lm, ld, il, ey, em, ed in cases:
        r = lunar2solar(ly, lm, ld, il)
        if r is None:
            print(f"  {FAIL}  음력 {ly}-{lm:02d}-{ld:02d} → 변환 실패")
            failed += 1
            continue
        ok = (r.year == ey and r.month == em and r.day == ed)
        status = PASS if ok else FAIL
        print(f"  {status}  음력 {ly}-{lm:02d}-{ld:02d}  →  "
              f"양력 {r.year}-{r.month:02d}-{r.day:02d}  "
              f"[기대: {ey}-{em:02d}-{ed:02d}]")
        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n  결과: {passed}개 통과, {failed}개 실패")
    return passed, failed


def validate_roundtrip():
    print("\n" + "="*60)
    print("  [검증] 왕복 변환 (양력→음력→양력)")
    print("="*60)
    print("  1900 ~ 2100 전체 날짜 샘플 검증 (매월 1일, 15일)")

    passed = failed = 0
    errors = []
    y = 1900
    while y <= 2099:
        for m in range(1, 13):
            for d in [1, 15]:
                try:
                    d_actual = d
                    # 말일 넘기지 않도록
                    try:
                        original = date(y, m, d_actual)
                    except ValueError:
                        continue
                    lr = solar2lunar(y, m, d_actual)
                    recovered = lunar2solar(lr["lYear"], lr["lMonth"], lr["lDay"], lr["isLeap"])
                    if recovered and recovered == original:
                        passed += 1
                    else:
                        failed += 1
                        errors.append((y, m, d_actual, lr, recovered))
                except Exception as e:
                    failed += 1
                    errors.append((y, m, d_actual, None, str(e)))
        y += 1

    if errors:
        print(f"\n  실패 케이스 (최대 10건):")
        for e in errors[:10]:
            print(f"    {e}")
    print(f"\n  결과: {passed}개 통과, {failed}개 실패 (총 {passed+failed}개 샘플)")
    return passed, failed


def validate_saju(year=None, month=None, day=None, hour=None):
    print("\n" + "="*60)
    print("  [검증] 사주 기둥 계산")
    print("="*60)

    if year and month and day:
        # 단일 날짜 상세 분석
        h = hour if hour is not None else 0
        yp = get_yp(year, month, day)
        mp = get_mp(year, month, day, yp["g"])
        dp = get_dp(year, month, day)
        hp = get_hp(dp["g"], h)
        lr = solar2lunar(year, month, day)
        leap_str = " (윤달)" if lr["isLeap"] else ""
        print(f"\n  입력:   양력 {year}-{month:02d}-{day:02d} {h:02d}시")
        print(f"  음력:   {lr['lYear']}-{lr['lMonth']:02d}-{lr['lDay']:02d}{leap_str}")
        print(f"\n  년주:   {pillar_str(yp)}  [{오행_str(yp)}]")
        print(f"  월주:   {pillar_str(mp)}  [{오행_str(mp)}]")
        print(f"  일주:   {pillar_str(dp)}  [{오행_str(dp)}]")
        print(f"  시주:   {pillar_str(hp)}  [{오행_str(hp)}]")

        # 오행 카운트
        all_pillars = [yp, mp, dp, hp]
        counts = {"목": 0, "화": 0, "토": 0, "금": 0, "수": 0}
        for p in all_pillars:
            counts[천간오행[p["g"]]] += 1
            counts[지지오행[p["j"]]] += 1
        print(f"\n  오행 분포:")
        for elem, cnt in counts.items():
            bar = "█" * cnt
            print(f"    {elem}: {bar} ({cnt})")
        return

    # 케이스 검증
    passed = failed = 0
    for sy, sm, sd, sh, exp_yp, exp_mp, exp_dp, exp_hp in SAJU_CASES:
        yp = get_yp(sy, sm, sd)
        mp = get_mp(sy, sm, sd, yp["g"])
        dp = get_dp(sy, sm, sd)
        hp = get_hp(dp["g"], sh)

        yp_s = 천간[yp["g"]] + 지지[yp["j"]]
        mp_s = 천간[mp["g"]] + 지지[mp["j"]]
        dp_s = 천간[dp["g"]] + 지지[dp["j"]]
        hp_s = 천간[hp["g"]] + 지지[hp["j"]]

        ok_yp = yp_s == exp_yp
        ok_mp = mp_s == exp_mp
        ok_dp = dp_s == exp_dp
        ok_hp = hp_s == exp_hp

        all_ok = ok_yp and ok_mp and ok_dp and ok_hp
        status = PASS if all_ok else FAIL
        print(f"\n  {status}  {sy}-{sm:02d}-{sd:02d} {sh:02d}시")

        def chk(label, got, exp, ok):
            s = PASS if ok else FAIL
            print(f"    {s} {label}: {got}  [기대: {exp}]")

        chk("년주", yp_s, exp_yp, ok_yp)
        chk("월주", mp_s, exp_mp, ok_mp)
        chk("일주", dp_s, exp_dp, ok_dp)
        chk("시주", hp_s, exp_hp, ok_hp)

        if all_ok:
            passed += 1
        else:
            failed += 1

    print(f"\n  결과: {passed}개 통과, {failed}개 실패")
    return passed, failed


def 오행_str(p):
    return f"{천간오행[p['g']]} / {지지오행[p['j']]}"


def custom_analysis(year, month, day, hour):
    print("\n" + "="*60)
    print(f"  [분석] {year}-{month:02d}-{day:02d} {hour:02d}시 상세 정보")
    print("="*60)
    validate_solar2lunar(year, month, day)
    validate_saju(year, month, day, hour)


# ─────────────────────────────────────────────
# 6. 메인
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="만세력 검증 스크립트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--mode",
        choices=["all", "solar", "lunar", "roundtrip", "saju", "custom"],
        default="all",
        help="검증 모드 (기본값: all)",
    )
    parser.add_argument("--year",  type=int, help="연도")
    parser.add_argument("--month", type=int, help="월")
    parser.add_argument("--day",   type=int, help="일")
    parser.add_argument("--hour",  type=int, default=0, help="시 (0~23, 기본값 0)")
    args = parser.parse_args()

    print("\n" + "="*60)
    print("  만세력 검증 스크립트 v1.0")
    print("  FateMix (index.html) JS 로직 Python 포팅 검증")
    print("="*60)

    total_passed = total_failed = 0

    mode = args.mode

    if mode == "custom":
        if not (args.year and args.month and args.day):
            print("  오류: --mode custom 사용 시 --year, --month, --day 를 지정하세요.")
            sys.exit(1)
        custom_analysis(args.year, args.month, args.day, args.hour)
        return

    if mode in ("all", "solar"):
        result = validate_solar2lunar(args.year, args.month, args.day)
        if result:
            total_passed += result[0]
            total_failed += result[1]

    if mode in ("all", "lunar"):
        result = validate_lunar2solar(args.year, args.month, args.day)
        if result:
            total_passed += result[0]
            total_failed += result[1]

    if mode in ("all", "roundtrip"):
        result = validate_roundtrip()
        if result:
            total_passed += result[0]
            total_failed += result[1]

    if mode in ("all", "saju"):
        result = validate_saju(args.year, args.month, args.day, args.hour)
        if result:
            total_passed += result[0]
            total_failed += result[1]

    if mode == "all":
        print("\n" + "="*60)
        color = "\033[92m" if total_failed == 0 else "\033[91m"
        print(f"  {color}전체 결과: {total_passed}개 통과, {total_failed}개 실패\033[0m")
        print("="*60 + "\n")


if __name__ == "__main__":
    main()
