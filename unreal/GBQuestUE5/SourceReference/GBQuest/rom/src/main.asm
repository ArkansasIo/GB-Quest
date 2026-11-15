INCLUDE "constants.inc"
INCLUDE "header.asm"

SECTION "Font Tiles", ROM0
FontTiles:
    INCBIN "font.2bpp"

SECTION "Game State", WRAM0
wMode: db
wScene: db
wPlayerX: db
wPlayerY: db

SECTION "Entry Point", ROM0[$0150]
Start:
    di
    xor a
    ldh [rLCDC], a
    ld [wMode], a
    ld [wScene], a
    ld a, 10
    ld [wPlayerX], a
    ld a, 13
    ld [wPlayerY], a
    ld a, $E4
    ldh [rBGP], a
    call LoadFont
    call RenderCurrentScene
    ld a, %10010001
    ldh [rLCDC], a
    xor a
    ldh [rIE], a
    ei

MainLoop:
    call WaitVBlank
    call ReadButtons
    call UpdateScene
    jr MainLoop

LoadFont:
    ld hl, FontTiles
    ld de, TILE_DATA
    ld bc, FONT_BYTES
.copy:
    ld a, [hli]
    ld [de], a
    inc de
    dec bc
    ld a, b
    or c
    jr nz, .copy
    ret

ClearTileMap:
    ld hl, BG_MAP
    ld bc, 32 * 32
    xor a
.clear:
    xor a
    ld [hli], a
    dec bc
    ld a, b
    or c
    jr nz, .clear
    ret

RenderCurrentScene:
    xor a
    ldh [rLCDC], a
    call ClearTileMap
    ld a, [wMode]
    and a
    jr z, .title
    cp MODE_PROLOGUE
    jr z, .prologue
    call RenderWorld
    jr .enable
.title:
    call RenderTitle
    jr .enable
.prologue:
    call RenderPrologue
.enable:
    ld a, %10010001
    ldh [rLCDC], a
    ret

RenderTitle:
    ld hl, TitleLine1
    ld de, BG_MAP + 32 * 5 + 5
    call DrawText
    ld hl, TitleLine2
    ld de, BG_MAP + 32 * 7 + 5
    call DrawText
    ld hl, TitleLine3
    ld de, BG_MAP + 32 * 10 + 2
    call DrawText
    ld hl, PressStart
    ld de, BG_MAP + 32 * 15 + 5
    call DrawText
    ret

RenderPrologue:
    ld hl, StoryTitle
    ld de, BG_MAP + 32 * 4 + 2
    call DrawText
    ld a, [wScene]
    and a
    jr z, .codex
    cp 1
    jr z, .pact
    ld hl, StoryRoad
    jr .draw
.codex:
    ld hl, StoryCodex
    jr .draw
.pact:
    ld hl, StoryPact
.draw:
    ld de, BG_MAP + 32 * 9 + 1
    call DrawText
    ld hl, NextPrompt
    ld de, BG_MAP + 32 * 15
    call DrawText
    ret

RenderWorld:
    ld hl, WorldTitle
    ld de, BG_MAP + 32 * 3 + 5
    call DrawText
    ld hl, WorldLine
    ld de, BG_MAP + 32 * 5 + 1
    call DrawText
    ld hl, ControlsLine
    ld de, BG_MAP + 32 * 15
    call DrawText
    ld a, [wPlayerY]
    ld l, a
    ld h, 0
    add hl, hl
    add hl, hl
    add hl, hl
    add hl, hl
    add hl, hl
    ld de, BG_MAP
    add hl, de
    ld a, [wPlayerX]
    add l
    ld l, a
    jr nc, .playerAddress
    inc h
.playerAddress:
    ld [hl], 39
    ret

UpdateScene:
    ld a, [wMode]
    and a
    jr z, .title
    cp MODE_PROLOGUE
    jr z, .prologue
    jp UpdateWorld
.title:
    bit BUTTON_START, b
    ret z
    ld a, MODE_PROLOGUE
    ld [wMode], a
    jp RenderCurrentScene
.prologue:
    bit BUTTON_START, b
    jr nz, .skip
    bit BUTTON_A, b
    ret z
    ld a, [wScene]
    inc a
    cp 3
    jr nc, .skip
    ld [wScene], a
    jp RenderCurrentScene
.skip:
    ld a, MODE_WORLD
    ld [wMode], a
    jp RenderCurrentScene

UpdateWorld:
    bit BUTTON_START, b
    jr nz, .toTitle
    bit BUTTON_A, b
    jr nz, .toStory
    bit 4, b
    jr nz, .moveUp
    bit 5, b
    jr nz, .moveDown
    bit 6, b
    jr nz, .moveLeft
    bit 7, b
    jr nz, .moveRight
    ret
.moveUp:
    ld hl, wPlayerY
    ld a, [hl]
    cp 1
    ret z
    dec [hl]
    jr .redraw
.moveDown:
    ld hl, wPlayerY
    ld a, [hl]
    cp 16
    ret nc
    inc [hl]
    jr .redraw
.moveLeft:
    ld hl, wPlayerX
    ld a, [hl]
    cp 1
    ret z
    dec [hl]
    jr .redraw
.moveRight:
    ld hl, wPlayerX
    ld a, [hl]
    cp 30
    ret nc
    inc [hl]
.redraw:
    jp RenderCurrentScene
.toStory:
    xor a
    ld [wScene], a
    ld a, MODE_PROLOGUE
    ld [wMode], a
    jp RenderCurrentScene
.toTitle:
    xor a
    ld [wMode], a
    jp RenderCurrentScene

WaitVBlank:
    ldh a, [rLY]
    cp 144
    jr c, WaitVBlank
.waitEnd:
    ldh a, [rLY]
    cp 144
    jr nc, .waitEnd
    ret

INCLUDE "render.asm"
INCLUDE "input.asm"
INCLUDE "scenes.asm"
INCLUDE "data.asm"
