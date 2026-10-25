#!/usr/bin/env bash
# 저장소 밖 금지어 목록(~/.config/starship/denylist, 한 줄에 하나)에 든 낱말이
# 커밋하려는 변경이나 커밋 메시지에 있으면 막는다. 목록 파일이 없으면 검사만 건너뛴다.
# 목록은 공개 저장소에 두지 않는다. 빈 줄과 #으로 시작하는 줄은 무시한다.
#
#   scripts/check-denylist.sh staged          # staged 변경에서 추가된 줄과 파일 이름
#   scripts/check-denylist.sh message <file>  # 커밋 메시지
set -euo pipefail

list="${STARSHIP_DENYLIST:-$HOME/.config/starship/denylist}"
if [[ ! -f "$list" ]]; then
  exit 0
fi

patterns="$(mktemp)"
trap 'rm -f "$patterns"' EXIT
grep -v -E '^[[:space:]]*(#|$)' "$list" | sed 's/[[:space:]]*$//' >"$patterns" || true
if [[ ! -s "$patterns" ]]; then
  exit 0
fi

case "${1:-}" in
  staged)
    found=0
    while IFS= read -r file; do
      if grep -q -i -F -f "$patterns" <<<"$file"; then
        echo "금지어: 파일 이름 $file"
        found=1
      fi
      if git diff --cached -U0 --no-color -- "$file" | grep -E '^\+' | grep -v -E '^\+\+\+ ' | grep -q -i -F -f "$patterns"; then
        echo "금지어: $file 에 추가한 줄"
        found=1
      fi
    done < <(git diff --cached --name-only --diff-filter=ACMR)
    if [[ $found -ne 0 ]]; then
      echo "금지어 목록($list)에 든 낱말이 있어 커밋을 막았습니다."
      exit 1
    fi
    ;;
  message)
    if grep -v -E '^#' "${2:?메시지 파일}" | grep -q -i -F -f "$patterns"; then
      echo "금지어: 커밋 메시지에 금지어 목록($list)의 낱말이 있습니다."
      exit 1
    fi
    ;;
  *)
    echo "사용법: $0 staged | message <file>" >&2
    exit 2
    ;;
esac
