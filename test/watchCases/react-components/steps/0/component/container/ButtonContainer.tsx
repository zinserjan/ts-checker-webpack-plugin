import * as React from "react";
import { Button, ButtonProps } from "../button/Button";
import { Container } from "./Container";

interface ButtonContainerProps extends ButtonProps {}

export class ButtonContainer extends React.Component<ButtonContainerProps, {}> {
  render() {
    const { ref, ...others } = this.props;

    return (
      <Container>
        <Button {...others}/>
      </Container>
    );
  }
}
