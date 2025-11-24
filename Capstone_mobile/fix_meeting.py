# -*- coding: utf-8 -*-
import codecs
from pathlib import Path
path = Path('app/chat/[conversationId].tsx')
txt = codecs.open(path, 'r', 'utf-8', 'ignore').read()
start = txt.find('const meetingStatus = useMemo')
end = txt.find('}, [messages]);', start)
if start == -1 or end == -1:
    raise SystemExit('markers not found')
new = """  const meetingStatus = useMemo(() => {
    const scheduleMsgs = messages.filter((msg) => msg.type === 'schedule');
    const lastSchedule = scheduleMsgs.length ? scheduleMsgs[scheduleMsgs.length - 1] : null;
    if (!lastSchedule) return { meeting: null, summaries: [] };

    const decision = messages.find((m) => m.type === 'schedule_response' && m.refId === lastSchedule.id);
    const resolvedStatus = lastSchedule.status || decision?.status;

    if (resolvedStatus !== 'accepted') {
      return { meeting: null, summaries: [] };
    }

    const summaries = messages.filter(
      (m) => m.type === 'session_summary' && m.refId === lastSchedule.id
    );

    return { meeting: lastSchedule, summaries };
  }, [messages]);
"""
new_txt = txt[:start] + new + txt[end+14:]
path.write_text(new_txt, encoding='utf-8')
print('patched')
