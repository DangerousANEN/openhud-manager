// HUD pack import / delete.
//
// A "pack" is just a folder under the overlays directory containing an
// index.html (plus whatever assets it needs). Import accepts a ZIP archive and
// unpacks it into its own subfolder so packs can never overwrite each other.

use crate::server::overlays_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub id: String,
    pub name: String,
    pub files: usize,
    pub has_index: bool,
    pub message: String,
}

/// Turn an arbitrary name into a safe folder name: ascii-ish, no separators.
fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in input.chars() {
        let c = ch.to_ascii_lowercase();
        if c.is_ascii_alphanumeric() {
            out.push(c);
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "pack".to_string()
    } else {
        trimmed
    }
}

/// Reject absolute paths, drive prefixes and any `..` component (zip-slip).
/// Returns the sanitised relative path, or None if the entry must be skipped.
fn safe_relative(raw: &str) -> Option<PathBuf> {
    let normalized = raw.replace('\\', "/");
    let candidate = Path::new(&normalized);

    let mut out = PathBuf::new();
    for comp in candidate.components() {
        match comp {
            Component::Normal(part) => out.push(part),
            // Anything else (RootDir, Prefix, ParentDir, CurDir) is unsafe or noise.
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
            Component::CurDir => continue,
        }
    }
    if out.as_os_str().is_empty() {
        None
    } else {
        Some(out)
    }
}

/// If the archive wraps everything in a single top folder, strip that level so
/// index.html lands at the pack root instead of pack/inner/index.html.
fn common_prefix(entries: &[PathBuf]) -> Option<PathBuf> {
    let mut prefix: Option<PathBuf> = None;
    for e in entries {
        let first = e.components().next()?;
        let first_path = PathBuf::from(first.as_os_str());
        // A file sitting at the archive root means there is no single wrapper.
        if e.components().count() == 1 {
            return None;
        }
        match &prefix {
            None => prefix = Some(first_path),
            Some(p) if *p == first_path => {}
            Some(_) => return None,
        }
    }
    prefix
}

/// Import a HUD pack from a ZIP file into the overlays directory.
#[tauri::command]
pub fn huds_import(zip_path: String, name: Option<String>) -> Result<ImportResult, String> {
    let archive_path = PathBuf::from(&zip_path);
    if !archive_path.is_file() {
        return Err(format!("Файл не найден: {zip_path}"));
    }

    let file = fs::File::open(&archive_path).map_err(|e| format!("Не удалось открыть архив: {e}"))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| format!("Это не похоже на ZIP-архив: {e}"))?;

    // First pass: collect safe entry paths so we can detect a wrapper folder.
    let mut planned: Vec<(usize, PathBuf, bool)> = Vec::new();
    for i in 0..zip.len() {
        let entry = zip
            .by_index(i)
            .map_err(|e| format!("Ошибка чтения записи архива: {e}"))?;
        let raw = entry.name().to_string();
        let is_dir = entry.is_dir();
        match safe_relative(&raw) {
            Some(rel) => planned.push((i, rel, is_dir)),
            None => continue, // skip unsafe / empty entries
        }
    }

    if planned.is_empty() {
        return Err("В архиве нет пригодных файлов".to_string());
    }

    let file_paths: Vec<PathBuf> = planned
        .iter()
        .filter(|(_, _, is_dir)| !*is_dir)
        .map(|(_, rel, _)| rel.clone())
        .collect();

    if file_paths.is_empty() {
        return Err("В архиве только папки, файлов нет".to_string());
    }

    let strip = common_prefix(&file_paths);

    // Pack folder name: explicit name > wrapper folder name > archive file stem.
    let base_name = name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| {
            strip
                .as_ref()
                .and_then(|p| p.to_str())
                .map(str::to_string)
        })
        .or_else(|| {
            archive_path
                .file_stem()
                .and_then(|s| s.to_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "pack".to_string());

    let root = overlays_dir();
    fs::create_dir_all(&root).map_err(|e| format!("Не удалось создать папку оверлеев: {e}"))?;

    // Never clobber an existing pack — suffix until the name is free.
    let slug = slugify(&base_name);
    let mut pack_id = slug.clone();
    let mut n = 2;
    while root.join(&pack_id).exists() {
        pack_id = format!("{slug}-{n}");
        n += 1;
    }
    let dest_root = root.join(&pack_id);
    fs::create_dir_all(&dest_root).map_err(|e| format!("Не удалось создать папку пака: {e}"))?;

    let mut written = 0usize;
    for (idx, rel, is_dir) in &planned {
        // Apply the wrapper strip, if any.
        let rel_final = match &strip {
            Some(prefix) => match rel.strip_prefix(prefix) {
                Ok(r) if !r.as_os_str().is_empty() => r.to_path_buf(),
                _ => continue,
            },
            None => rel.clone(),
        };

        let out_path = dest_root.join(&rel_final);

        // Belt and braces: the resolved path must stay inside dest_root.
        if !out_path.starts_with(&dest_root) {
            continue;
        }

        if *is_dir {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Не удалось создать папку {}: {e}", out_path.display()))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Не удалось создать папку {}: {e}", parent.display()))?;
        }

        let mut entry = zip
            .by_index(*idx)
            .map_err(|e| format!("Ошибка чтения записи архива: {e}"))?;
        let mut out = fs::File::create(&out_path)
            .map_err(|e| format!("Не удалось записать {}: {e}", out_path.display()))?;
        io::copy(&mut entry, &mut out)
            .map_err(|e| format!("Ошибка распаковки {}: {e}", out_path.display()))?;
        written += 1;
    }

    let has_index = dest_root.join("index.html").is_file();
    let message = if has_index {
        format!("Пак «{pack_id}» установлен, файлов: {written}")
    } else {
        format!(
            "Пак «{pack_id}» распакован ({written} файлов), но index.html в корне не найден — \
             в OBS такой пак не подхватится"
        )
    };

    Ok(ImportResult {
        id: pack_id,
        name: base_name,
        files: written,
        has_index,
        message,
    })
}

/// Delete a HUD pack folder. Refuses anything that escapes the overlays dir.
#[tauri::command]
pub fn huds_delete(id: String) -> Result<String, String> {
    if id.trim().is_empty() {
        return Err("Не указан идентификатор пака".to_string());
    }

    let root = overlays_dir();
    let rel = safe_relative(&id).ok_or("Недопустимое имя пака")?;
    if rel.components().count() != 1 {
        return Err("Недопустимое имя пака".to_string());
    }

    let target = root.join(&rel);
    let target_canon = target
        .canonicalize()
        .map_err(|_| format!("Пак «{id}» не найден"))?;
    let root_canon = root
        .canonicalize()
        .map_err(|e| format!("Папка оверлеев недоступна: {e}"))?;

    if !target_canon.starts_with(&root_canon) || target_canon == root_canon {
        return Err("Недопустимый путь пака".to_string());
    }
    if !target_canon.is_dir() {
        return Err(format!("Пак «{id}» не найден"));
    }

    fs::remove_dir_all(&target_canon).map_err(|e| format!("Не удалось удалить пак: {e}"))?;
    Ok(format!("Пак «{id}» удалён"))
}

// ─── Unit tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── slugify ──────────────────────────────────────────────────────────────

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify("My Cool Pack"), "my-cool-pack");
    }

    #[test]
    fn slugify_numbers_kept() {
        assert_eq!(slugify("pack2025"), "pack2025");
    }

    #[test]
    fn slugify_strips_leading_trailing_dashes() {
        assert_eq!(slugify("__hello__"), "hello");
    }

    #[test]
    fn slugify_consecutive_specials_collapse() {
        assert_eq!(slugify("a...b"), "a-b");
    }

    #[test]
    fn slugify_empty_falls_back() {
        assert_eq!(slugify("!!!"), "pack");
    }

    // ── safe_relative ────────────────────────────────────────────────────────

    #[test]
    fn safe_relative_normal_path() {
        let p = safe_relative("assets/img/logo.png").unwrap();
        assert_eq!(p, PathBuf::from("assets/img/logo.png"));
    }

    #[test]
    fn safe_relative_rejects_parent_dir() {
        assert!(safe_relative("../secret.txt").is_none());
    }

    #[test]
    fn safe_relative_rejects_absolute_unix() {
        assert!(safe_relative("/etc/passwd").is_none());
    }

    #[test]
    fn safe_relative_normalises_backslash() {
        // Windows-style paths inside zip archives must still be sanitised.
        let p = safe_relative(r"assets\img\logo.png").unwrap();
        assert_eq!(p, PathBuf::from("assets/img/logo.png"));
    }

    #[test]
    fn safe_relative_rejects_empty() {
        assert!(safe_relative("").is_none());
    }

    #[test]
    fn safe_relative_strips_cur_dir() {
        let p = safe_relative("./index.html").unwrap();
        assert_eq!(p, PathBuf::from("index.html"));
    }

    // ── common_prefix ────────────────────────────────────────────────────────

    #[test]
    fn common_prefix_single_wrapper() {
        let entries = vec![
            PathBuf::from("pack/index.html"),
            PathBuf::from("pack/assets/app.js"),
        ];
        assert_eq!(common_prefix(&entries), Some(PathBuf::from("pack")));
    }

    #[test]
    fn common_prefix_root_file_disables_stripping() {
        let entries = vec![
            PathBuf::from("index.html"),
            PathBuf::from("pack/assets/app.js"),
        ];
        assert_eq!(common_prefix(&entries), None);
    }

    #[test]
    fn common_prefix_multiple_top_dirs() {
        let entries = vec![
            PathBuf::from("a/index.html"),
            PathBuf::from("b/app.js"),
        ];
        assert_eq!(common_prefix(&entries), None);
    }

    #[test]
    fn common_prefix_empty() {
        assert_eq!(common_prefix(&[]), None);
    }
}
