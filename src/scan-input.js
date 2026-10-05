// Do not infer scan boundaries from typing speed: legitimate rapid taps must survive.
export function scanInputIssue(raw){
  if(/[\r\n\t]/.test(raw))return {kind:'multiple',message:'Multiple lines or scan endings detected. Scan one card at a time. Nothing was queued.'};
  const value=raw.trim().toUpperCase();
  if(value.length>128)return {kind:'length',message:'This barcode is too long. Clear it and scan one card again. Nothing was queued.'};
  // Only detect exact repeated blocks, never truncate an ID or guess a member.
  for(let size=3;size<=value.length/2;size++){
    if(value.length%size)continue;
    const unit=value.slice(0,size),count=value.length/size;
    if(unit.repeat(count)===value)return {kind:'repeated',unit,count,message:'This looks like the same barcode joined '+count+' times. Scan one card again. Nothing was queued.'};
  }
  return null;
}
