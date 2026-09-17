//! Install bundled HUDs and update only files whose previous bundled content is unchanged.
use std::{collections::BTreeMap, fs, io, path::Path};
use sha2::{Digest, Sha256};
use tauri::Manager;
fn digest(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }
fn install_tree(source: &Path, destination: &Path) -> io::Result<()> {
    fs::create_dir_all(destination)?;
    let manifest = destination.join(".bundled-manifest.json");
    let old: BTreeMap<String, String> = fs::read(&manifest).ok()
        .and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
    let mut next = old.clone();
    fn walk(root: &Path, from: &Path, dest: &Path, old: &BTreeMap<String,String>, next: &mut BTreeMap<String,String>) -> io::Result<()> {
        for entry in fs::read_dir(from)? {
            let entry=entry?; let path=entry.path(); let rel=path.strip_prefix(root).unwrap();
            let target=dest.join(rel); let kind=entry.file_type()?;
            if kind.is_dir() { fs::create_dir_all(&target)?; walk(root,&path,dest,old,next)?; }
            else if kind.is_file() {
                let key=rel.to_string_lossy().replace('\\',"/");
                let bytes=fs::read(&path)?; let hash=digest(&bytes);
                let existing=fs::read(&target).ok().map(|b|digest(&b));
                if existing.is_none() || existing.as_ref()==old.get(&key) || existing.as_ref()==Some(&hash) {
                    fs::write(&target,&bytes)?; next.insert(key,hash);
                }
                // An untracked or edited user file is preserved, never silently overwritten.
            }
        }
        Ok(())
    }
    walk(source,source,destination,&old,&mut next)?;
    fs::write(manifest,serde_json::to_vec_pretty(&next)?)?;
    Ok(())
}
pub fn install(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let resources=app.path().resource_dir()?.join("overlays");
    let development=Path::new(env!("CARGO_MANIFEST_DIR")).join("../overlays");
    let source=if resources.is_dir(){resources}else{development};
    if !source.is_dir(){return Err("Bundled HUD resources are missing".into());}
    install_tree(&source,&crate::server::overlays_dir())?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fresh_install_upgrade_and_user_changes() {
        let root=std::env::temp_dir().join(format!("protokol-seed-{}",uuid::Uuid::new_v4()));
        let src=root.join("source");let dst=root.join("installed");
        fs::create_dir_all(src.join("_core")).unwrap();
        fs::write(src.join("_core/core.js"),"v1").unwrap();
        install_tree(&src,&dst).unwrap();
        assert_eq!(fs::read_to_string(dst.join("_core/core.js")).unwrap(),"v1");
        fs::write(src.join("_core/core.js"),"v2").unwrap();
        install_tree(&src,&dst).unwrap();
        assert_eq!(fs::read_to_string(dst.join("_core/core.js")).unwrap(),"v2");
        fs::write(dst.join("_core/core.js"),"custom").unwrap();
        fs::write(src.join("_core/core.js"),"v3").unwrap();
        install_tree(&src,&dst).unwrap();
        assert_eq!(fs::read_to_string(dst.join("_core/core.js")).unwrap(),"custom");
        fs::remove_dir_all(root).unwrap();
    }
}
