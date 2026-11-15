DrawText:
.next:
    ld a, [hli]
    and a
    ret z
    call CharacterTile
    ld [de], a
    inc de
    jr .next

CharacterTile:
    cp ' '
    jr z, .space
    cp 'A'
    jr c, .digit
    cp 'Z' + 1
    jr nc, .digit
    sub 'A' - 1
    ret
.digit:
    cp '0'
    jr c, .punctuation
    cp '9' + 1
    jr nc, .punctuation
    sub '0' - 27
    ret
.punctuation:
    cp '@'
    jr z, .player
    cp '-'
    jr z, .dash
    cp '.'
    jr z, .period
    xor a
    ret
.space:
    xor a
    ret
.dash:
    ld a, 37
    ret
.period:
    ld a, 38
    ret
.player:
    ld a, 39
    ret
