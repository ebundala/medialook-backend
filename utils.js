

module.exports={
    replaceHtml:(str)=>{
    return str
    .replace(new RegExp("&quot;","g")," ")
    .replace(new RegExp("&amp;","g")," ")
    .replace(new RegExp("&lt;","g")," ")
    .replace(new RegExp("&gt;","g")," ")
    .replace(new RegExp("&nbsp;","g")," ")
    .replace(new RegExp("&iexcl;","g")," ")
    .replace(new RegExp("&laquo;","g")," ")
    .replace(new RegExp("&raquo;","g")," ")
    .replace(new RegExp("&#039;","g"),"")
}

}