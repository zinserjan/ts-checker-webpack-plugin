import * as React from "react";

export interface ButtonProps extends React.HTMLProps<HTMLButtonElement> {}


export class Button extends React.Component<ButtonProps, {}> {
  render() {
    return (
      <button {...this.props}/>
    );
  }
}
