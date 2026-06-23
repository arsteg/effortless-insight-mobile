import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';

// Simple Button component for testing (matches typical app structure)
interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    testID="button"
    accessibilityRole="button"
    accessibilityState={{ disabled: disabled || loading }}
  >
    {loading ? (
      <ActivityIndicator testID="loading-indicator" />
    ) : (
      <Text testID="button-text">{title}</Text>
    )}
  </TouchableOpacity>
);

describe('Button Component', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders correctly with title', () => {
    const { getByTestId, getByText } = render(
      <Button title="Click Me" onPress={mockOnPress} />
    );

    expect(getByTestId('button')).toBeTruthy();
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const { getByTestId } = render(
      <Button title="Click Me" onPress={mockOnPress} />
    );

    fireEvent.press(getByTestId('button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const { getByTestId } = render(
      <Button title="Click Me" onPress={mockOnPress} disabled />
    );

    fireEvent.press(getByTestId('button'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    const { getByTestId, queryByText } = render(
      <Button title="Click Me" onPress={mockOnPress} loading />
    );

    expect(getByTestId('loading-indicator')).toBeTruthy();
    expect(queryByText('Click Me')).toBeNull();
  });

  it('does not call onPress when loading', () => {
    const { getByTestId } = render(
      <Button title="Click Me" onPress={mockOnPress} loading />
    );

    fireEvent.press(getByTestId('button'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });
});
