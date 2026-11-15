SECTION "Entry", ROM0[$0100]
    nop
    jp Start
    ds $0134 - @, 0

SECTION "Cartridge Header", ROM0[$0134]
    db "SHADOWBANE"
    ds $0143 - @, 0
    db CGB_FLAG
    ds $0150 - @, 0
