# Binoculars score (Hans et al., 2024, "Spotting LLMs With Binoculars", ICML): perplexity of the text under a
# "performer" model divided by the cross-perplexity between an "observer" and the performer. Lower = more
# machine-like. A research test for the thesis checker, not part of the website.
#
#   pip install torch transformers
#   OBS=Qwen/Qwen2.5-1.5B PERF=Qwen/Qwen2.5-1.5B-Instruct python3 scripts/thesis-binoculars.py sets.json scores.json
#
# sets.json maps a group name to a list of paragraphs. Models download from Hugging Face (huggingface.co,
# us.aws.cdn.hf.co and cas-server.xethub.hf.co must be reachable). Results: docs/10-THESIS-AI-TOOLS.md.
import json, sys, random, math, torch
from transformers import AutoTokenizer, AutoModelForCausalLM
torch.set_num_threads(4)
import os
OBS, PERF = os.environ["OBS"], os.environ["PERF"]
tok = AutoTokenizer.from_pretrained(OBS)
obs = AutoModelForCausalLM.from_pretrained(OBS, dtype=torch.bfloat16).eval()
perf = AutoModelForCausalLM.from_pretrained(PERF, dtype=torch.bfloat16).eval()

@torch.no_grad()
def score(text, max_tokens=256):
    ids = tok(text, return_tensors="pt", truncation=True, max_length=max_tokens).input_ids
    lo = obs(ids).logits[0, :-1].float()
    lp = perf(ids).logits[0, :-1].float()
    target = ids[0, 1:]
    logp_perf = torch.log_softmax(lp, -1)
    ppl = -logp_perf.gather(1, target[:, None]).mean()            # log-perplexity under the performer
    x_ppl = -(torch.softmax(lo, -1) * logp_perf).sum(-1).mean()    # cross-perplexity observer -> performer
    return (ppl / x_ppl).item()

sets = json.load(open(sys.argv[1]))
out = {}
for name, texts in sets.items():
    out[name] = [score(t) for t in texts]
    s = sorted(out[name]); print(f"{name:42} n={len(s):4} median {s[len(s)//2]:.3f}  mean {sum(s)/len(s):.3f}", flush=True)
json.dump(out, open(sys.argv[2], "w"))
