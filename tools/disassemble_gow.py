import os
import sys
import struct
import time
from elftools.elf.elffile import ELFFile
from capstone import Cs, CS_ARCH_MIPS, CS_MODE_MIPS32

KNOWN_NIDS = {
    # sceDisplay
    0x0E20F177: "sceDisplaySetMode",
    0x289D82FE: "sceDisplaySetFrameBuf",
    0x984C27E7: "sceDisplayWaitVblankStart",
    0x9C6EAAD7: "sceDisplayWaitVblank",
    0xDBA6C4C4: "sceDisplayGetFrameBuf",

    # sceCtrl
    0x1F4011E6: "sceCtrlReadBufferPositive",
    0x3A622550: "sceCtrlSetSamplingCycle",
    0x6A2774F3: "sceCtrlSetSamplingMode",
    0xA7144800: "sceCtrlSetIdleCancelThreshold",

    # sceGe_user
    0xAB49E76A: "sceGeListEnQueue",
    0x03444EB4: "sceGeListEnQueueHead",
    0x1F6752AD: "sceGeEdramGetAddr",
    0x4C06E472: "sceGeContinue",
    0xB77905EA: "sceGeEdramGetSize",
    0xE47E40E4: "sceGeDrawSync",

    # IoFileMgrForUser
    0x109F50BC: "sceIoOpen",
    0x6A638D83: "sceIoRead",
    0x42EC03AC: "sceIoWrite",
    0x810C4BC3: "sceIoClose",
    0x27EB27B8: "sceIoLseek",
    0xACE946E8: "sceIoGetstat",
    0x06A70004: "sceIoAsync",
    0x779103A0: "sceIoWait",
    0xE3EB004C: "sceIoDopen",
    0xEB092469: "sceIoDread",
    0xF27A9C51: "sceIoDclose",

    # ThreadManForUser
    0x446D8DE6: "sceKernelCreateThread",
    0xF475845D: "sceKernelStartThread",
    0xAA73C935: "sceKernelExitThread",
    0xCEADEB47: "sceKernelDelayThread",
    0xD6DA4BA1: "sceKernelCreateSema",
    0x28B6489C: "sceKernelDeleteSema",
    0x3F53E640: "sceKernelSignalSema",
    0x4E3A1105: "sceKernelWaitSema",
    0x55C20A00: "sceKernelCreateEventFlag",
    0x82BC5777: "sceKernelWaitEventFlag",
    0x1FB15A32: "sceKernelSetEventFlag",
    0x278C0DF5: "sceKernelWaitThreadEnd",
    0x9FA03CD3: "sceKernelDeleteThread",

    # SysMemUserForUser
    0x13A5ABEF: "sceKernelFreePartitionMemory",
    0xF77D77CB: "sceKernelSetCompilerVersion",
    0x1B4217BC: "sceKernelSetCompiledSdkVersion",
    0x237DBD4F: "sceKernelAllocPartitionMemory",
    0x9D9A5BA1: "sceKernelGetBlockHeadAddr",

    # Kernel_Library
    0x293B45B8: "sceKernelDcacheWritebackAll",
    0x092968F4: "sceKernelCpuSuspendIntr",
    0xA089ECA4: "sceKernelCpuResumeIntr",
    0x1839852A: "sceKernelDcacheInvalidateRange",
    0x5F10D406: "sceKernelDcacheWritebackRange",
    0xB55249D2: "sceKernelDcacheWritebackInvalidateRange",

    # Audio
    0x136CAF51: "sceAudioOutputPannedBlocking",
    0x13F592BC: "sceAudioOutputPanned",
    0x5EC81C55: "sceAudioChReserve",
    0x6FC46853: "sceAudioChRelease",
    0x01562BA3: "sceAudioOutputBlocking",

    # SasCore
    0x019B25EB: "sceSasInit",
    0x07F58C24: "sceSasSetVoice",
    0x267A6DD2: "sceSasCore",
    0x42778A9F: "sceSasSetVolume",
    0x50A14DFC: "sceSasSetPitch",
    0xAD84D37F: "sceSasSetKeyOn",
    0xBD11B7C2: "sceSasSetKeyOff",

    # Atrac3plus
    0x2DD3E298: "sceAtracSetHalfwayBuffer",
    0x7A20E7AF: "sceAtracReleaseAtracID",
    0x6A8C3CD5: "sceAtracGetSecondBufferInfo",
    0xD5A229C9: "sceAtracSetData",
}

def main():
    elf_path = "extracted/gow/EBOOT.ELF"
    out_dir = "extracted/gow"
    os.makedirs(out_dir, exist_ok=True)

    print("Carregando binário ELF MIPS:", elf_path)
    start_t = time.time()

    with open(elf_path, "rb") as f:
        elf = ELFFile(f)

        def read_vaddr(vaddr, size):
            for s in elf.iter_segments():
                sv = s["p_vaddr"]
                if sv <= vaddr < sv + s["p_filesz"]:
                    off = s["p_offset"] + (vaddr - sv)
                    f.seek(off)
                    return f.read(size)
            return b""

        # 1. Mapeamento das tabelas de Stubs e NIDs
        stub_map = {}
        lib_stub = elf.get_section_by_name(".lib.stub")
        if lib_stub:
            stub_data = lib_stub.data()
            for i in range(0, len(stub_data), 20):
                name_ptr, ver, flags, size_struct, nids_cnt, stub_cnt, nids_ptr, stubs_ptr = struct.unpack("<IHHBBHII", stub_data[i:i+20])
                mod_name = read_vaddr(name_ptr, 64).split(b"\x00")[0].decode("ascii", errors="ignore")
                nids_data = read_vaddr(nids_ptr, stub_cnt * 4)
                nids = [struct.unpack("<I", nids_data[j*4:(j+1)*4])[0] for j in range(stub_cnt)]
                for idx, nid in enumerate(nids):
                    stub_addr = stubs_ptr + idx * 8
                    func_name = KNOWN_NIDS.get(nid, f"{mod_name}_{nid:08X}")
                    stub_map[stub_addr] = (mod_name, nid, func_name)

        print(f"Mapeados {len(stub_map)} stubs da biblioteca do sistema PSP.")

        # 2. Obter a seção .text (código MIPS)
        text_sec = elf.get_section_by_name(".text")
        text_data = text_sec.data()
        text_addr = text_sec["sh_addr"]
        text_size = len(text_data)
        total_insns = text_size // 4
        print(f"Seção .text: 0x{text_addr:08x} - {text_size} bytes ({total_insns:,} instruções MIPS-II)")

        # 3. Inicializa Capstone
        md = Cs(CS_ARCH_MIPS, CS_MODE_MIPS32)
        md.detail = False

        func_entry = elf.header.e_entry

        def iterate_instructions():
            offset = 0
            while offset < text_size:
                chunk = text_data[offset:text_size]
                dis = list(md.disasm(chunk, offset))
                if dis:
                    for insn in dis:
                        yield insn.address, insn.mnemonic, insn.op_str, False
                    last = dis[-1]
                    offset = last.address + last.size
                if offset < text_size:
                    word = struct.unpack("<I", text_data[offset:offset+4])[0]
                    yield offset, ".word", f"0x{word:08x}", True
                    offset += 4

        # Primeira passada: encontrar alvos de salto (JAL, J, Branches) para gerar labels
        print("Fase 1/2: Analisando alvos de chamadas (JAL), branches e funções...")
        call_targets = set()
        branch_targets = set()
        call_targets.add(func_entry)

        insn_count = 0
        for addr, mn, op, is_fallback in iterate_instructions():
            insn_count += 1
            if is_fallback:
                continue

            if mn in ("jal", "j"):
                try:
                    target = int(op, 16) if op.startswith("0x") else int(op)
                    if text_addr <= target < text_addr + text_size:
                        call_targets.add(target)
                except ValueError:
                    pass
            elif mn.startswith("b") and not mn.startswith("break"):
                parts = op.split(",")
                if parts:
                    last = parts[-1].strip()
                    try:
                        target = int(last, 16) if last.startswith("0x") else int(last)
                        if text_addr <= target < text_addr + text_size:
                            branch_targets.add(target)
                    except ValueError:
                        pass

        print(f"Total de instruções analisadas: {insn_count:,}")
        print(f"Identificadas {len(call_targets):,} funções e {len(branch_targets):,} labels de branch.")

        # Fase 2: Gerar arquivo de desmontagem completo
        asm_out_path = f"{out_dir}/gow_disassembly.asm"
        summary_out_path = f"{out_dir}/gow_symbols.txt"
        print(f"Fase 2/2: Escrevendo desmontagem completa em {asm_out_path}...")

        with open(summary_out_path, "w") as s_out:
            s_out.write(f"# God of War: Ghost of Sparta - Mapeamento de Simbolos\n")
            s_out.write(f"# Entry Point: 0x{func_entry:08x}\n")
            s_out.write(f"# Total Instrucoes: {total_insns:,}\n")
            s_out.write(f"# Total Funcoes: {len(call_targets):,}\n")
            s_out.write(f"# Total Labels de Branch: {len(branch_targets):,}\n\n")
            s_out.write("### STUBS DO SISTEMA PSP (206 FUNCOES) ###\n")
            for addr, (mod, nid, fname) in sorted(stub_map.items()):
                s_out.write(f"0x{addr:08x} -> {mod}::{fname} (NID: 0x{nid:08X})\n")

        written_count = 0
        with open(asm_out_path, "w") as out:
            out.write("; =========================================================================\n")
            out.write("; GOD OF WAR: GHOST OF SPARTA (PSP) - DESMONTAGEM MIPS NATIVA COMPLETA\n")
            out.write(f"; Entry Point: 0x{func_entry:08x} | Total de Instrucoes: {total_insns:,}\n")
            out.write(f"; Total de Funcoes Identificadas: {len(call_targets):,} | Labels: {len(branch_targets):,}\n")
            out.write("; Gerado para o Runtime de Recompilacao WebAssembly / WebGL\n")
            out.write("; =========================================================================\n\n")

            for addr, mn, op, is_fallback in iterate_instructions():
                written_count += 1

                if addr in call_targets:
                    stub_info = stub_map.get(addr)
                    if stub_info:
                        fname = stub_info[2]
                        out.write(f"\n; -------------------------------------------------------------------------\n")
                        out.write(f"; SCE STUB: {fname} [{stub_info[0]}]\n")
                        out.write(f"{fname}:\n")
                    else:
                        out.write(f"\n; -------------------------------------------------------------------------\n")
                        out.write(f"func_{addr:08x}:\n")

                elif addr in branch_targets:
                    out.write(f"loc_{addr:08x}:\n")

                # Anota chamadas com o nome do stub se houver
                comment = ""
                if mn == "jal":
                    try:
                        target = int(op, 16) if op.startswith("0x") else int(op)
                        if target in stub_map:
                            comment = f" ; -> {stub_map[target][2]}"
                        elif target in call_targets:
                            comment = f" ; -> func_{target:08x}"
                    except ValueError:
                        pass

                out.write(f"  0x{addr:08x}:  {mn:8} {op:<32}{comment}\n")

                if written_count % 250000 == 0:
                    pct = (written_count / total_insns) * 100
                    print(f"  Progresso da escrita: {written_count:,} / {total_insns:,} ({pct:.1f}%)...")

    elapsed = time.time() - start_t
    size_mb = os.path.getsize(asm_out_path) / (1024 * 1024)
    print(f"\nDESCOMPILAÇÃO CONCLUÍDA EM {elapsed:.2f}s!")
    print(f"Arquivo gerado: {asm_out_path} ({size_mb:.2f} MB)")
    print(f"Tabela de símbolos: {summary_out_path}")

if __name__ == "__main__":
    main()
