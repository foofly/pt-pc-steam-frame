"""Makes the CUSA01127 game folder the port reads (chunk1.psarc, texture.qar, pathid_list_ps4.bin, source.txt) from your
own P.T. fake PKG or console dump, and nothing else: no runtime install, no renamed PKG, no empty-folder rule.

    python tools/prepare_game.py <P.T. pkg or dump folder> <folder with pt> [--to <user@host:folder>]

The PKG is any file name. <folder with pt> may already exist (a build, the unpacked Steam Frame release); CUSA01127/ is
written inside it, next to pt, where the game finds it without --game. --replace swaps an existing CUSA01127/.
--to copies the finished CUSA01127/ to another machine with rsync (the Steam Frame: <user>@<frame>:~/Games/pt-steamframe).

The extraction itself is the upstream installer's: the PT.PkgExtract helper (LibOrbisPkg, LGPL, docs/installer.md) from
an existing install's extractor/ folder (--extractor), or else the Linux setup (--setup, default: a
P.T.PC.Port.Setup-linux* beside the input or in ~/Downloads) installed to a temporary folder of which only CUSA01127/ is
kept. Both are x86-64 Linux programs: run this on the PC, not on the Frame. This script holds no keys and no game data.
"""
import argparse, os, shutil, subprocess, sys, tempfile
from pathlib import Path

GAME = "CUSA01127"
# the helper is .NET and does no culture-specific work: without this it stops on systems without libicu (minimal
# distributions, toolboxes); the setup passes its environment on to the helper
HELPER_ENV = {**os.environ, "DOTNET_SYSTEM_GLOBALIZATION_INVARIANT": "1"}


def looks_like_game(folder):
    return (folder / "chunk1.psarc").is_file() and (folder / "texture.qar").is_file()


def find_setup(source):
    for folder in (source.parent, Path.home() / "Downloads", Path.home() / "Downloads" / "PT"):
        found = sorted(folder.glob("P.T.PC.Port.Setup-linux*"))
        if found:
            return found[-1]
    return None


def extract_with_helper(helper, source, out):
    log = out.parent / "extraction.log"
    with open(log, "w") as stream:
        result = subprocess.run([str(helper), str(source), str(out)], stdout=stream, stderr=subprocess.STDOUT, env=HELPER_ENV)
    print(log.read_text(), end="")
    if result.returncode:
        sys.exit("the extraction helper refused the input (message above)")


def extract_with_setup(setup, source, work):
    install, result = work / "install", work / "result.txt"
    os.chmod(setup, os.stat(setup).st_mode | 0o111)
    print(f"running {setup.name} --install into a temporary folder (it unpacks its runtime first, then the game files)")
    code = subprocess.run([str(setup), "--install", str(source), str(install), str(result)], env=HELPER_ENV).returncode
    message = result.read_text().strip() if result.is_file() else ""
    if code or not looks_like_game(install / GAME):
        sys.exit(f"the setup did not install the game files: {message or f'exit {code}'}")
    print(message)
    return install / GAME


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", type=Path, help="P.T. fake PKG (any name) or a dumped/extracted game folder")
    p.add_argument("target", type=Path, help="folder that gets CUSA01127/ (the folder with pt); created if missing")
    p.add_argument("--extractor", type=Path, help="PT.PkgExtract from an install's extractor/ folder")
    p.add_argument("--setup", type=Path, help="P.T.PC.Port.Setup-linux, when no extractor is at hand")
    p.add_argument("--replace", action="store_true", help="replace an existing CUSA01127/ in the target")
    p.add_argument("--to", help="rsync the result to this destination (user@host:folder)")
    args = p.parse_args()

    source, target = args.source.expanduser().resolve(), args.target.expanduser().resolve()
    final = target / GAME
    if not source.exists():
        sys.exit(f"{source} does not exist")
    if final.exists() and not args.replace:
        if looks_like_game(final):
            print(f"{final} already holds the game files (--replace to extract again)")
        else:
            sys.exit(f"{final} exists but is not a game folder; move it away or use --replace")
    else:
        target.mkdir(parents=True, exist_ok=True)
        # the work folder sits in the target so the result moves into place without a copy
        with tempfile.TemporaryDirectory(prefix=".pt-prepare-", dir=target) as tmp:
            work = Path(tmp)
            if source.is_dir() and looks_like_game(source):
                print(f"{source} is already an extracted game folder; copying it")
                made = work / GAME
                shutil.copytree(source, made)
            else:
                helper = args.extractor
                if not helper and not args.setup:
                    for folder in (source.parent, source.parent / "install", target):
                        if (folder / "extractor" / "PT.PkgExtract").is_file():
                            helper = folder / "extractor" / "PT.PkgExtract"
                            break
                if helper and source.is_file():
                    print(f"extracting with {helper}")
                    made = work / GAME
                    extract_with_helper(helper.resolve(), source, made)
                else:
                    setup = args.setup or find_setup(source)
                    if not setup:
                        sys.exit("no extraction helper or Linux setup found: pass --extractor <install>/extractor/PT.PkgExtract "
                                 "or --setup <P.T.PC.Port.Setup-linux>")
                    made = extract_with_setup(setup.expanduser().resolve(), source, work)
            if not looks_like_game(made):
                sys.exit("the result has no chunk1.psarc and texture.qar")
            if final.exists():
                shutil.rmtree(final)
            made.rename(final)

    for name in ("chunk1.psarc", "texture.qar", "pathid_list_ps4.bin"):
        path = final / name
        print(f"  {name:22} {path.stat().st_size / 1e6:9.1f} MB" if path.is_file() else f"  {name:22} missing")
    if (final / "source.txt").is_file():
        print("".join(f"  {line}\n" for line in (final / "source.txt").read_text().splitlines()), end="")
    print(f"game folder ready: {final}")

    if args.to:
        print(f"copying to {args.to}")
        if subprocess.run(["rsync", "-a", "--info=progress2", str(final), args.to]).returncode:
            sys.exit("rsync failed")


if __name__ == "__main__":
    main()
