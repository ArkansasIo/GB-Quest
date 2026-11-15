ReadButtons:
    ld a, $20
    ldh [rJOYP], a
    ldh a, [rJOYP]
    cpl
    and $0F
    ld b, a
    ld a, $10
    ldh [rJOYP], a
    ldh a, [rJOYP]
    cpl
    and $0F
    swap a
    or b
    ld b, a
    ld a, $30
    ldh [rJOYP], a
    ret
