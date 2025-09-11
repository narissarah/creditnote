// UI compatibility utilities for Shopify POS UI Extensions 2025
// This file provides compatibility helpers and type fixes

export type CompatButtonProps = {
  title?: string;
  type?: 'primary' | 'secondary' | 'plain';
  onPress?: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  children?: string;
};

export type CompatTextFieldProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  multiline?: boolean;
  maxLength?: number;
};

export type CompatBannerProps = {
  title: string;
  variant: 'info' | 'success' | 'warning' | 'critical';
  action?: string;
  onPress?: () => void;
  hideAction?: boolean;
  visible: boolean;
  children?: any;
};

export type CompatTextProps = {
  variant?: 'body' | 'heading' | 'headingSmall' | 'headingMedium' | 'headingLarge' | 'caption';
  children: any;
};

export type Spacing = 'none' | 'extraTight' | 'tight' | 'base' | 'loose' | 'extraLoose';

export type CompatBlockStackProps = {
  spacing?: Spacing;
  children: any;
};

export type CompatInlineStackProps = {
  spacing?: Spacing;
  alignment?: 'start' | 'center' | 'end';
  children: any;
};

// Helper functions for compatibility
export const mapButtonProps = (props: any): CompatButtonProps => {
  return {
    title: props.children || props.title,
    type: props.kind === 'primary' ? 'primary' : 'secondary',
    onPress: props.onPress,
    isDisabled: props.disabled || props.isDisabled,
    isLoading: props.loading || props.isLoading
  };
};

export const mapTextFieldProps = (props: any): CompatTextFieldProps => {
  return {
    label: props.label,
    value: props.value,
    onChange: props.onChange,
    onBlur: props.onBlur,
    placeholder: props.placeholder,
    disabled: props.disabled,
    error: props.error,
    multiline: props.multiline === true || typeof props.multiline === 'number',
    maxLength: props.maxLength
  };
};

export const mapBannerProps = (props: any): CompatBannerProps => {
  return {
    title: props.title || '',
    variant: props.tone || props.status || 'info',
    action: props.action,
    onPress: props.onPress,
    hideAction: props.hideAction,
    visible: props.visible !== false,
    children: props.children
  };
};

export const mapSpacing = (spacing: any): Spacing => {
  if (typeof spacing === 'string') {
    switch (spacing) {
      case 'extraTight': return 'extraTight';
      case 'tight': return 'tight';
      case 'loose': return 'loose';
      case 'extraLoose': return 'extraLoose';
      case 'none': return 'none';
      default: return 'base';
    }
  }
  return 'base';
};

// Toast utilities
export type ToastMessage = {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
};

export const showToast = (toast: any, message: string | ToastMessage): void => {
  if (typeof message === 'string') {
    toast.show({ message });
  } else {
    toast.show({ message: message.message });
  }
};