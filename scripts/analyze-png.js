/**
 * 分析 PNG 图片的元数据，用于调试 ComfyUI 提示词提取问题
 * 使用方法: node scripts/analyze-png.js <图片路径>
 */

const fs = require('fs');
const path = require('path');

// 读取 PNG chunks（简化版，基于浏览器代码）
function extractPngTextChunks(filePath) {
  const buffer = fs.readFileSync(filePath);
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  
  // PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) {
    if (dv.getUint8(i) !== sig[i]) {
      throw new Error('Not a valid PNG file');
    }
  }
  
  let pos = 8;
  const out = {};
  const textDecoder = new TextDecoder('utf-8');
  
  while (pos + 8 <= dv.byteLength) {
    const length = dv.getUint32(pos, false); // big-endian
    const type = String.fromCharCode(
      dv.getUint8(pos + 4),
      dv.getUint8(pos + 5),
      dv.getUint8(pos + 6),
      dv.getUint8(pos + 7)
    );
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;
    
    if (dataEnd + 4 > dv.byteLength) break;
    
    if (type === "tEXt") {
      const raw = new Uint8Array(buffer.buffer, buffer.byteOffset + dataStart, length);
      const idx = raw.indexOf(0);
      const key = textDecoder.decode(raw.slice(0, Math.max(0, idx)));
      const val = textDecoder.decode(raw.slice(idx + 1));
      out[key] = val;
    } else if (type === "iTXt") {
      const raw = new Uint8Array(buffer.buffer, buffer.byteOffset + dataStart, length);
      let p = 0;
      const readToNull = () => {
        const start = p;
        while (p < raw.length && raw[p] !== 0) p++;
        const result = textDecoder.decode(raw.slice(start, p));
        p++; // skip null
        return result;
      };
      const keyword = readToNull();
      const compressionFlag = raw[p++];
      const compressionMethod = raw[p++];
      const languageTag = readToNull();
      const translatedKeyword = readToNull();
      const text = readToNull();
      out[keyword] = text;
    } else if (type === "zTXt") {
      const raw = new Uint8Array(buffer.buffer, buffer.byteOffset + dataStart, length);
      const idx = raw.indexOf(0);
      const keyword = textDecoder.decode(raw.slice(0, Math.max(0, idx)));
      const compressionMethod = raw[idx + 1];
      if (compressionMethod === 0) {
        // zlib decompression
        const zlib = require('zlib');
        const compressed = raw.slice(idx + 2);
        try {
          const decompressed = zlib.inflateSync(compressed);
          const text = textDecoder.decode(decompressed);
          out[keyword] = text;
        } catch (e) {
          console.warn(`Failed to decompress zTXt chunk for ${keyword}:`, e.message);
        }
      }
    }
    
    pos = dataEnd + 4; // skip CRC
  }
  
  return out;
}

// 解析 ComfyUI workflow（简化版）
function parseComfyWorkflow(workflowStr) {
  try {
    const wfObj = typeof workflowStr === 'string' ? JSON.parse(workflowStr) : workflowStr;
    
    // 获取 nodes
    const nodes = Array.isArray(wfObj.nodes) ? wfObj.nodes : Object.values(wfObj).filter(n => 
      n && (n.type || n.class_type || n._meta) && (n.inputs || n.widgets_values || n.properties)
    );
    
    // 获取 links
    const links = wfObj?.links || [];
    
    // 找出所有 CLIPTextEncode 节点
    const textEncodeNodes = nodes.filter(n => {
      const t = (n?.type || n?.class_type || '').toLowerCase();
      return t.includes('cliptextencode') || t.includes('textencode') || t.includes('prompt');
    });
    
    // 找出所有 KSampler 节点
    const kSamplerNodes = nodes.filter(n => {
      const t = (n?.type || n?.class_type || '').toLowerCase();
      return t.includes('ksampler');
    });
    
    return {
      nodes,
      links,
      textEncodeNodes,
      kSamplerNodes,
      workflow: wfObj
    };
  } catch (e) {
    console.error('Failed to parse workflow:', e);
    return null;
  }
}

// 主函数
function analyzePNG(imagePath) {
  console.log(`\n🔍 分析图片: ${imagePath}\n`);
  
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 文件不存在: ${imagePath}`);
    return;
  }
  
  try {
    // 1. 提取 PNG chunks
    const chunks = extractPngTextChunks(imagePath);
    console.log('📋 PNG chunks found:', Object.keys(chunks));
    console.log('');
    
    // 2. 分析 workflow chunk
    const workflowChunk = chunks.workflow || chunks.Workflow || chunks.WORKFLOW || 
                         chunks["comfyui_workflow"] || chunks["ComfyUI_Workflow"];
    
    if (workflowChunk) {
      console.log('✅ 找到 workflow chunk');
      const parsed = parseComfyWorkflow(workflowChunk);
      
      if (parsed) {
        console.log(`   节点总数: ${parsed.nodes.length}`);
        console.log(`   CLIPTextEncode 节点数: ${parsed.textEncodeNodes.length}`);
        console.log(`   KSampler 节点数: ${parsed.kSamplerNodes.length}`);
        console.log(`   Links 数量: ${parsed.links.length}`);
        console.log('');
        
        // 详细分析每个 CLIPTextEncode 节点
        parsed.textEncodeNodes.forEach((node, idx) => {
          const nodeId = node?.id ?? node?._meta?.id ?? idx;
          const nodeType = node?.type || node?.class_type || 'unknown';
          const nodeLabel = node?._meta?.title || node?.name || node?.label || '';
          
          console.log(`📝 CLIPTextEncode 节点 #${idx + 1}:`);
          console.log(`   ID: ${nodeId}`);
          console.log(`   Type: ${nodeType}`);
          console.log(`   Label: ${nodeLabel || '(无)'}`);
          console.log(`   Inputs:`, JSON.stringify(node?.inputs || [], null, 2));
          console.log(`   Widgets_values:`, JSON.stringify(node?.widgets_values || [], null, 2));
          console.log(`   Properties:`, JSON.stringify(node?.properties || {}, null, 2));
          
          // 尝试提取提示词
          const widgets = node?.widgets_values || [];
          const textFromWidgets = widgets.find(w => typeof w === 'string' && w.length > 10);
          if (textFromWidgets) {
            console.log(`   ✅ 找到提示词 (widgets_values): ${textFromWidgets.substring(0, 100)}...`);
          }
          
          const textFromInputs = node?.inputs?.text || node?.inputs?.prompt || node?.inputs?.positive || node?.inputs?.negative;
          if (textFromInputs && typeof textFromInputs === 'string') {
            console.log(`   ✅ 找到提示词 (inputs): ${textFromInputs.substring(0, 100)}...`);
          }
          
          console.log('');
        });
        
        // 分析连接关系
        if (parsed.links.length > 0) {
          console.log('🔗 连接关系分析:');
          parsed.links.forEach((link, idx) => {
            if (Array.isArray(link) && link.length >= 4) {
              const [sourceNodeId, , targetNodeId, targetInputIndex] = link;
              const sourceNode = parsed.nodes.find(n => (n?.id ?? n?._meta?.id) === sourceNodeId);
              const targetNode = parsed.nodes.find(n => (n?.id ?? n?._meta?.id) === targetNodeId);
              
              if (sourceNode && targetNode) {
                const sourceType = (sourceNode?.type || sourceNode?.class_type || '').toLowerCase();
                const targetType = (targetNode?.type || targetNode?.class_type || '').toLowerCase();
                
                if (sourceType.includes('cliptextencode') && targetType.includes('ksampler')) {
                  console.log(`   连接 #${idx + 1}: 节点 ${sourceNodeId} (CLIPTextEncode) -> 节点 ${targetNodeId} (KSampler) [输入索引: ${targetInputIndex}]`);
                }
              }
            }
          });
          console.log('');
        }
      }
    } else {
      console.log('⚠️ 未找到 workflow chunk');
    }
    
    // 3. 分析 prompt chunk
    const promptChunk = chunks.prompt || chunks.Prompt || chunks.PROMPT || 
                       chunks["comfyui_prompt"] || chunks["ComfyUI_Prompt"];
    
    if (promptChunk) {
      console.log('✅ 找到 prompt chunk');
      const parsed = parseComfyWorkflow(promptChunk);
      if (parsed) {
        console.log(`   节点总数: ${parsed.nodes.length}`);
        console.log(`   CLIPTextEncode 节点数: ${parsed.textEncodeNodes.length}`);
      }
    }
    
  } catch (e) {
    console.error('❌ 分析失败:', e);
    console.error(e.stack);
  }
}

// 运行
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('使用方法: node scripts/analyze-png.js <图片路径>');
  process.exit(1);
}

analyzePNG(imagePath);



