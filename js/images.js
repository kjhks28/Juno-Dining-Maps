function readImage(file){ return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("사진을 읽지 못했어요.")); reader.readAsDataURL(file); }); }
async function compressPhoto(file){
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024) throw new Error("사진은 5MB 이하 JPG, PNG, WebP만 첨부해 주세요.");
  const source=await readImage(file); const image=new Image(); await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("올바른 이미지 파일이 아니에요."));image.src=source;}); const scale=Math.min(1,1200/Math.max(image.width,image.height)); const canvas=document.createElement("canvas"); canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height); return canvas.toDataURL("image/jpeg",.78);
}
export async function preparePhotos(files,previous){ if(!files.length) return previous?.photos??[]; if(files.length>3) throw new Error("사진은 최대 3장까지 첨부할 수 있어요."); return Promise.all([...files].map(compressPhoto)); }
