import { useState } from 'react';

export function useEditedTreeName(currentTreeName: string | null) {
  const [editedTreeName, setEditedTreeName] = useState<string | null>(currentTreeName || '');
  const [isComposing, setIsComposing] = useState(false);
  const [prevCurrentTreeName, setPrevCurrentTreeName] = useState(currentTreeName);

  if (currentTreeName !== prevCurrentTreeName) {
    setPrevCurrentTreeName(currentTreeName);
    setEditedTreeName(currentTreeName);
  }

  return { editedTreeName, setEditedTreeName, isComposing, setIsComposing };
}
