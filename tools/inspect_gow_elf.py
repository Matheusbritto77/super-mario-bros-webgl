from elftools.elf.elffile import ELFFile
import sys

def main():
    with open("extracted/gow/EBOOT.ELF", "rb") as f:
        elf = ELFFile(f)
        print("=== God of War - Ghost of Sparta EBOOT.ELF ===")
        print("Entry point:", hex(elf.header.e_entry))
        print("Machine:", elf.header.e_machine)
        print("Type:", elf.header.e_type)
        print("\n--- Program Segments ---")
        for seg in elf.iter_segments():
            p_type = seg["p_type"]
            vaddr = hex(seg["p_vaddr"])
            filesz = seg["p_filesz"]
            memsz = seg["p_memsz"]
            flags = seg["p_flags"]
            print("  Type: %-15s VAddr: %-10s Filesz: %8d Memsz: %8d Flags: %d" % (p_type, vaddr, filesz, memsz, flags))

        print("\n--- Sections ---")
        for s in elf.iter_sections():
            name = s.name
            vaddr = hex(s["sh_addr"])
            size = s["sh_size"]
            flags = s["sh_flags"]
            print("  %-25s | Addr: %-10s | Size: %8d | Flags: %d" % (name, vaddr, size, flags))

if __name__ == "__main__":
    main()
