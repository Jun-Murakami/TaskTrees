import { useRef, useEffect, useState } from 'react';
import { useInputDialogStore } from '@/store/dialogStore';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export function InputDialog() {
  const hideDialog = useInputDialogStore((state) => state.hideDialog);
  const resolveDialog = useInputDialogStore((state) => state.resolveDialog);
  const defaultValue = useInputDialogStore((state) => state.defaultValue);
  const isPassword = useInputDialogStore((state) => state.isPassword);

  const [inputValue, setInputValue] = useState<string>(''); // テキストフィールドの値を保持するステートを作成

  const inputRef = useRef<HTMLInputElement>(null); // テキストフィールドへの参照を作成 // テキストフィールドへの参照を作成

  // コンポーネントがマウントされた後にフォーカスを設定
  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  }, []);

  return (
    <Dialog open={useInputDialogStore((state) => state.isDialogVisible)} onClose={hideDialog}>
      <DialogTitle>{useInputDialogStore((state) => state.dialogTitle)}</DialogTitle>
      <DialogContent>
        <DialogContentText>{useInputDialogStore((state) => state.dialogMessage)}</DialogContentText>
        <TextField
          autoFocus
          inputRef={inputRef}
          margin='dense'
          id={isPassword ? 'filled-password-input' : 'filled-basic'}
          variant='outlined'
          label={useInputDialogStore((state) => state.dialogLabel)}
          type={isPassword ? 'password' : 'text'}
          defaultValue={defaultValue}
          fullWidth
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inputValue !== '') {
              e.preventDefault(); // デフォルトの挙動をキャンセル
              resolveDialog?.(inputValue);
              hideDialog();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant='contained'
          onClick={() => {
            resolveDialog?.(inputValue);
            hideDialog();
          }}
        >
          OK
        </Button>
        <Button
          variant='outlined'
          onClick={() => {
            resolveDialog?.('');
            hideDialog();
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
