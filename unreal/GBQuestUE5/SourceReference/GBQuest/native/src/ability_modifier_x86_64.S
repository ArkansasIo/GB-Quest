/*
 * System V AMD64 ABI:
 *   int32_t gbq_ability_modifier_asm(int32_t score)
 * Input:  EDI = ability score
 * Output: EAX = floor((score - 10) / 2)
 *
 * Sign extension before subtraction avoids 32-bit overflow at INT32_MIN.
 */
.text
.globl gbq_ability_modifier_asm
.type gbq_ability_modifier_asm, @function
gbq_ability_modifier_asm:
    movslq %edi, %rax
    subq $10, %rax
    sarq $1, %rax
    ret
.size gbq_ability_modifier_asm, .-gbq_ability_modifier_asm

.section .note.GNU-stack,"",@progbits
